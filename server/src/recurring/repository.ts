import type { Pool, PoolClient } from 'pg'
import { DomainError } from '../management/domain.js'
import { assertForwardSchedule, type RecurringRuleInput, type RecurringRuleKind } from './domain.js'
import { getNextOccurrenceDate, getPragueToday, isRecurringOccurrenceDue, isRecurringRuleEnded, type RecurringFrequency } from './schedule.js'
import { invalidateWealthCache } from '../wealth-cache.js'

export type RecurringRuleLabel = { id: string; name: string }

export type RecurringRule = {
  id: string
  name: string
  kind: RecurringRuleKind
  amountCzk: number
  walletId: string | null
  walletName: string | null
  categoryId: string | null
  categoryName: string | null
  categoryIconKey: string | null
  categoryColorKey: string | null
  categoryDirection: 'income' | 'expense' | null
  sourceWalletId: string | null
  sourceWalletName: string | null
  destinationWalletId: string | null
  destinationWalletName: string | null
  note: string | null
  labels: RecurringRuleLabel[]
  frequency: RecurringFrequency
  customIntervalDays: number | null
  nextOccurrenceDate: string
  endsOn: string | null
  status: 'active' | 'ended'
  sortOrder: number
}

export type RecurringGenerationResult = {
  processedRules: number
  generatedTransactions: number
  generatedTransfers: number
  failedRuleIds: string[]
}

export type RecurringRuleRepository = {
  listRules(userId: string): Promise<RecurringRule[]>
  createRule(userId: string, input: RecurringRuleInput, today: string): Promise<RecurringRule>
  updateRule(userId: string, ruleId: string, input: RecurringRuleInput, today: string): Promise<RecurringRule | null>
  deleteRule(userId: string, ruleId: string): Promise<boolean>
  reorderRules(userId: string, ruleIds: string[]): Promise<void>
  generateDue(today: string): Promise<RecurringGenerationResult>
}

type RuleRow = {
  id: string
  name: string
  kind: RecurringRuleKind
  amount_czk: string
  transaction_wallet_id: string | null
  transaction_wallet_name: string | null
  category_id: string | null
  category_name: string | null
  category_icon_key: string | null
  category_color_key: string | null
  category_direction: 'income' | 'expense' | null
  source_wallet_id: string | null
  source_wallet_name: string | null
  destination_wallet_id: string | null
  destination_wallet_name: string | null
  note: string | null
  frequency: RecurringFrequency
  custom_interval_days: number | null
  schedule_anchor_date: string
  next_occurrence_date: string
  ends_on: string | null
  status: 'active' | 'ended'
  sort_order: number
  labels: unknown
}

type DueRuleRow = {
  id: string
  user_id: string
  kind: RecurringRuleKind
  amount_czk: string
  transaction_wallet_id: string | null
  category_id: string | null
  source_wallet_id: string | null
  destination_wallet_id: string | null
  note: string | null
  frequency: RecurringFrequency
  custom_interval_days: number | null
  schedule_anchor_date: string
  next_occurrence_date: string
  ends_on: string | null
}

const maxOccurrencesPerRulePerRun = 1000

export function createRecurringRuleRepository(pool: Pool): RecurringRuleRepository {
  return {
    async listRules(userId) {
      const result = await pool.query<RuleRow>(ruleSelect('r.user_id = $1', 'order by r.sort_order asc, r.id asc'), [userId])
      return result.rows.map(toRule)
    },

    async createRule(userId, input, today = getPragueToday()) {
      return withTransaction(pool, async (client) => {
        await assertLabelsExist(client, userId, input.labelIds)
        const created = await client.query<{ id: string }>(
          `with next_order as (
             select coalesce(max(sort_order) + 1, 0) as sort_order
             from recurring_rules
             where user_id = $1
           )
           insert into recurring_rules (
            user_id, name, kind, amount_czk, transaction_wallet_id, category_id,
            source_wallet_id, destination_wallet_id, note, frequency, custom_interval_days,
            schedule_anchor_date, next_occurrence_date, ends_on, sort_order
          )
          select $1, $2, $3::recurring_rule_kind, $4, $5, $6, $7, $8, $9, $10::recurring_frequency, $11, $12, $13, $14, next_order.sort_order
          from next_order
          returning id`,
          ruleValues(userId, input),
        )
        const ruleId = created.rows[0]?.id
        if (!ruleId) throw new Error('Vytvoření opakování nevrátilo ID.')
        await replaceRuleLabels(client, userId, ruleId, input.labelIds)
        await materializeDueOccurrences(client, today, ruleId)
        return requireRule(client, userId, ruleId)
      })
    },

    async updateRule(userId, ruleId, input, today = getPragueToday()) {
      return withTransaction(pool, async (client) => {
        await assertLabelsExist(client, userId, input.labelIds)
        const current = await client.query<{ kind: RecurringRuleKind; next_occurrence_date: string; schedule_anchor_date: string; ends_on: string | null }>(
          `select kind,
                  to_char(next_occurrence_date, 'YYYY-MM-DD') as next_occurrence_date,
                  to_char(schedule_anchor_date, 'YYYY-MM-DD') as schedule_anchor_date,
                  to_char(ends_on, 'YYYY-MM-DD') as ends_on
           from recurring_rules
           where user_id = $1 and id = $2
           for update`,
          [userId, ruleId],
        )
        const existing = current.rows[0]
        if (!existing) return null
        if (input.kind !== existing.kind) throw new DomainError(400, 'Typ opakování nelze po vytvoření změnit.')

        // Only re-validate the schedule as forward-looking when it's actually being changed.
        // An ended rule's frozen schedule (next_occurrence_date > ends_on, possibly in the past)
        // must stay editable for its other fields without this rejecting the unchanged dates.
        const scheduleChanged = input.nextOccurrenceDate !== existing.next_occurrence_date || input.endsOn !== existing.ends_on
        if (scheduleChanged) assertForwardSchedule(input.nextOccurrenceDate, input.endsOn, today)

        // The anchor only moves when the caller actually changed the next occurrence date.
        // Editing unrelated fields (name, amount, labels, ...) must not re-anchor the schedule,
        // or a drifted next_occurrence_date (e.g. 31st -> 28th after a short month) would
        // permanently overwrite the original calendar-day intent.
        const scheduleAnchorDate = input.nextOccurrenceDate === existing.next_occurrence_date
          ? existing.schedule_anchor_date
          : input.nextOccurrenceDate

        const status = isRecurringRuleEnded({ nextOccurrenceDate: input.nextOccurrenceDate, endsOn: input.endsOn }) ? 'ended' : 'active'

        const updated = await client.query<{ id: string }>(
          `update recurring_rules
           set name = $3,
             kind = $4::recurring_rule_kind,
             amount_czk = $5,
             transaction_wallet_id = $6,
             category_id = $7,
             source_wallet_id = $8,
             destination_wallet_id = $9,
             note = $10,
             frequency = $11::recurring_frequency,
             custom_interval_days = $12,
             schedule_anchor_date = $13,
             next_occurrence_date = $14,
             ends_on = $15,
             status = $16::recurring_rule_status
           where user_id = $1 and id = $2
           returning id`,
          [userId, ruleId, ...ruleValues(userId, input).slice(1, -3), scheduleAnchorDate, input.nextOccurrenceDate, input.endsOn, status],
        )
        if (!updated.rows[0]) return null
        await replaceRuleLabels(client, userId, ruleId, input.labelIds)
        if (status === 'active') await materializeDueOccurrences(client, today, ruleId)
        return requireRule(client, userId, ruleId)
      })
    },

    async deleteRule(userId, ruleId) {
      const result = await pool.query(
        `delete from recurring_rules where user_id = $1 and id = $2 returning id`,
        [userId, ruleId],
      )
      return Boolean(result.rows[0])
    },

    async reorderRules(userId, ruleIds) {
      await withTransaction(pool, async (client) => {
        const current = await client.query<{ id: string }>(
          `select id from recurring_rules where user_id = $1 order by id asc for update`,
          [userId],
        )
        assertExactRuleIds(current.rows.map((row) => row.id), ruleIds)
        for (const [sortOrder, ruleId] of ruleIds.entries()) {
          await client.query(
            `update recurring_rules set sort_order = $3 where user_id = $1 and id = $2`,
            [userId, ruleId, sortOrder],
          )
        }
      })
    },

    async generateDue(today) {
      const due = await pool.query<{ id: string }>(
        `select id from recurring_rules
         where status = 'active'
           and next_occurrence_date <= $1::date
           and (ends_on is null or next_occurrence_date <= ends_on)
         order by next_occurrence_date asc, id asc`,
        [today],
      )

      // Each rule commits in its own transaction: one rule hitting an error (or the
      // per-run occurrence limit) must not roll back the occurrences already generated
      // and committed for every other rule in this run.
      const result: RecurringGenerationResult = { processedRules: 0, generatedTransactions: 0, generatedTransfers: 0, failedRuleIds: [] }
      for (const { id: ruleId } of due.rows) {
        try {
          const ruleResult = await withTransaction(pool, (client) => materializeDueOccurrences(client, today, ruleId))
          result.processedRules += ruleResult.processedRules
          result.generatedTransactions += ruleResult.generatedTransactions
          result.generatedTransfers += ruleResult.generatedTransfers
        } catch {
          result.failedRuleIds.push(ruleId)
        }
      }
      if (result.generatedTransactions > 0 || result.generatedTransfers > 0) invalidateWealthCache()
      return result
    },
  }
}

async function materializeDueOccurrences(client: PoolClient, today: string, ruleId: string | null = null) {
  const dueRules = await client.query<DueRuleRow>(
    `select id, user_id, kind, amount_czk, transaction_wallet_id, category_id,
      source_wallet_id, destination_wallet_id, note, frequency, custom_interval_days,
      to_char(schedule_anchor_date, 'YYYY-MM-DD') as schedule_anchor_date,
      to_char(next_occurrence_date, 'YYYY-MM-DD') as next_occurrence_date,
      to_char(ends_on, 'YYYY-MM-DD') as ends_on
     from recurring_rules
     where status = 'active'
       and next_occurrence_date <= $1::date
       and (ends_on is null or next_occurrence_date <= ends_on)
       and ($2::uuid is null or id = $2::uuid)
     order by next_occurrence_date asc, id asc
     for update skip locked`,
    [today, ruleId],
  )

  const result: RecurringGenerationResult = { processedRules: 0, generatedTransactions: 0, generatedTransfers: 0, failedRuleIds: [] }
  for (const rule of dueRules.rows) {
    let nextOccurrenceDate = rule.next_occurrence_date
    let generatedForRule = 0

    while (isRecurringOccurrenceDue({ nextOccurrenceDate, endsOn: rule.ends_on, today })) {
      if (generatedForRule >= maxOccurrencesPerRulePerRun) {
        throw new Error(`Recurring rule ${rule.id} exceeded the per-run occurrence limit.`)
      }

      if (!await occurrenceAlreadyRecorded(client, rule.user_id, rule.id, nextOccurrenceDate)) {
        if (rule.kind === 'transaction') {
          const transactionId = await createGeneratedTransaction(client, rule, nextOccurrenceDate)
          await copyRuleLabelsToTransaction(client, rule.user_id, rule.id, transactionId)
          await recordOccurrence(client, rule.user_id, rule.id, nextOccurrenceDate, transactionId, null)
          result.generatedTransactions += 1
        } else {
          const transferId = await createGeneratedTransfer(client, rule, nextOccurrenceDate)
          await copyRuleLabelsToTransfer(client, rule.user_id, rule.id, transferId)
          await recordOccurrence(client, rule.user_id, rule.id, nextOccurrenceDate, null, transferId)
          result.generatedTransfers += 1
        }
      }

      nextOccurrenceDate = getNextOccurrenceDate({
        frequency: rule.frequency,
        customIntervalDays: rule.custom_interval_days,
        scheduleAnchorDate: rule.schedule_anchor_date,
        nextOccurrenceDate,
      })
      generatedForRule += 1
    }

    const status = isRecurringRuleEnded({ nextOccurrenceDate, endsOn: rule.ends_on }) ? 'ended' : 'active'
    await client.query(
      `update recurring_rules
       set next_occurrence_date = $3::date,
           status = $4::recurring_rule_status
       where user_id = $1 and id = $2`,
      [rule.user_id, rule.id, nextOccurrenceDate, status],
    )
    result.processedRules += 1
  }
  return result
}

function ruleValues(userId: string, input: RecurringRuleInput) {
  return [
    userId,
    input.name,
    input.kind,
    input.amountCzk,
    input.walletId,
    input.categoryId,
    input.sourceWalletId,
    input.destinationWalletId,
    input.note,
    input.frequency,
    input.customIntervalDays,
    input.nextOccurrenceDate,
    input.nextOccurrenceDate,
    input.endsOn,
  ]
}

function ruleSelect(filter: string, order: string) {
  return `select r.id, r.name, r.kind, r.amount_czk, r.transaction_wallet_id,
    transaction_wallet.name as transaction_wallet_name, r.category_id,
    category.name as category_name, category.icon_key as category_icon_key,
    category.color_key as category_color_key, category.direction as category_direction,
    r.source_wallet_id, source_wallet.name as source_wallet_name,
    r.destination_wallet_id, destination_wallet.name as destination_wallet_name,
    r.note, r.frequency, r.custom_interval_days, r.status,
    to_char(r.schedule_anchor_date, 'YYYY-MM-DD') as schedule_anchor_date,
    to_char(r.next_occurrence_date, 'YYYY-MM-DD') as next_occurrence_date,
    to_char(r.ends_on, 'YYYY-MM-DD') as ends_on,
    r.sort_order,
    coalesce(
      json_agg(json_build_object('id', label.id, 'name', label.name) order by label.normalized_name asc, label.id asc)
      filter (where label.id is not null),
      '[]'::json
    ) as labels
  from recurring_rules r
  left join wallets transaction_wallet on transaction_wallet.user_id = r.user_id and transaction_wallet.id = r.transaction_wallet_id
  left join categories category on category.user_id = r.user_id and category.id = r.category_id
  left join wallets source_wallet on source_wallet.user_id = r.user_id and source_wallet.id = r.source_wallet_id
  left join wallets destination_wallet on destination_wallet.user_id = r.user_id and destination_wallet.id = r.destination_wallet_id
  left join recurring_rule_labels rule_label on rule_label.user_id = r.user_id and rule_label.recurring_rule_id = r.id
  left join labels label on label.user_id = r.user_id and label.id = rule_label.label_id
  where ${filter}
  group by r.id, r.name, r.kind, r.amount_czk, r.transaction_wallet_id, transaction_wallet.name,
    r.category_id, category.name, category.icon_key, category.color_key, category.direction,
    r.source_wallet_id, source_wallet.name, r.destination_wallet_id, destination_wallet.name,
    r.note, r.frequency, r.custom_interval_days, r.status, r.schedule_anchor_date, r.next_occurrence_date, r.ends_on
  ${order}`
}

async function requireRule(client: PoolClient, userId: string, ruleId: string) {
  const result = await client.query<RuleRow>(ruleSelect('r.user_id = $1 and r.id = $2::uuid', ''), [userId, ruleId])
  const rule = result.rows[0]
  if (!rule) throw new Error('Opakování nebylo po uložení nalezeno.')
  return toRule(rule)
}

function toRule(row: RuleRow): RecurringRule {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    amountCzk: Number(row.amount_czk),
    walletId: row.transaction_wallet_id,
    walletName: row.transaction_wallet_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryIconKey: row.category_icon_key,
    categoryColorKey: row.category_color_key,
    categoryDirection: row.category_direction,
    sourceWalletId: row.source_wallet_id,
    sourceWalletName: row.source_wallet_name,
    destinationWalletId: row.destination_wallet_id,
    destinationWalletName: row.destination_wallet_name,
    note: row.note,
    labels: parseLabels(row.labels),
    frequency: row.frequency,
    customIntervalDays: row.custom_interval_days,
    nextOccurrenceDate: row.next_occurrence_date,
    endsOn: row.ends_on,
    status: row.status,
    sortOrder: row.sort_order,
  }
}

function assertExactRuleIds(currentIds: string[], requestedIds: string[]) {
  const expected = [...currentIds].sort()
  const received = [...requestedIds].sort()
  if (expected.length !== received.length || expected.some((id, index) => id !== received[index])) {
    throw new DomainError(409, 'Pořadí opakování neodpovídá aktuálním datům.')
  }
}

async function assertLabelsExist(client: PoolClient, userId: string, labelIds: string[]) {
  if (labelIds.length === 0) return
  const result = await client.query<{ id: string }>(
    `select id from labels where user_id = $1 and id = any($2::uuid[])`,
    [userId, labelIds],
  )
  if (result.rows.length !== labelIds.length) throw new DomainError(404, 'Jeden nebo více štítků neexistuje.')
}

async function replaceRuleLabels(client: PoolClient, userId: string, ruleId: string, labelIds: string[]) {
  await client.query(`delete from recurring_rule_labels where user_id = $1 and recurring_rule_id = $2`, [userId, ruleId])
  if (labelIds.length === 0) return
  await client.query(
    `insert into recurring_rule_labels (user_id, recurring_rule_id, label_id)
     select $1, $2, unnest($3::uuid[])`,
    [userId, ruleId, labelIds],
  )
}

async function createGeneratedTransaction(client: PoolClient, rule: DueRuleRow, occurrenceDate: string) {
  const result = await client.query<{ id: string }>(
    `insert into transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
     values ($1, $2, $3, $4, $5::date, $6)
     returning id`,
    [rule.user_id, rule.transaction_wallet_id, rule.category_id, rule.amount_czk, occurrenceDate, rule.note],
  )
  const transactionId = result.rows[0]?.id
  if (!transactionId) throw new Error('Generování opakované transakce nevrátilo ID.')
  return transactionId
}

async function createGeneratedTransfer(client: PoolClient, rule: DueRuleRow, occurrenceDate: string) {
  const result = await client.query<{ id: string }>(
    `insert into transfers (user_id, source_wallet_id, destination_wallet_id, amount_czk, transfer_date, note)
     values ($1, $2, $3, $4, $5::date, $6)
     returning id`,
    [rule.user_id, rule.source_wallet_id, rule.destination_wallet_id, rule.amount_czk, occurrenceDate, rule.note],
  )
  const transferId = result.rows[0]?.id
  if (!transferId) throw new Error('Generování opakovaného převodu nevrátilo ID.')
  return transferId
}

async function copyRuleLabelsToTransaction(client: PoolClient, userId: string, ruleId: string, transactionId: string) {
  await client.query(
    `insert into transaction_labels (user_id, transaction_id, label_id)
     select user_id, $3::uuid, label_id
     from recurring_rule_labels
     where user_id = $1 and recurring_rule_id = $2`,
    [userId, ruleId, transactionId],
  )
}

async function copyRuleLabelsToTransfer(client: PoolClient, userId: string, ruleId: string, transferId: string) {
  await client.query(
    `insert into transfer_labels (user_id, transfer_id, label_id)
     select user_id, $3::uuid, label_id
     from recurring_rule_labels
     where user_id = $1 and recurring_rule_id = $2`,
    [userId, ruleId, transferId],
  )
}

async function recordOccurrence(client: PoolClient, userId: string, ruleId: string, occurrenceDate: string, transactionId: string | null, transferId: string | null) {
  await client.query(
    `insert into recurring_rule_occurrences (user_id, recurring_rule_id, occurrence_date, transaction_id, transfer_id)
     values ($1, $2, $3::date, $4, $5)`,
    [userId, ruleId, occurrenceDate, transactionId, transferId],
  )
}

async function occurrenceAlreadyRecorded(client: PoolClient, userId: string, ruleId: string, occurrenceDate: string) {
  const result = await client.query<{ exists: boolean }>(
    `select exists(
      select 1 from recurring_rule_occurrences
      where user_id = $1 and recurring_rule_id = $2 and occurrence_date = $3::date
    ) as exists`,
    [userId, ruleId, occurrenceDate],
  )
  return result.rows[0]?.exists ?? false
}

function parseLabels(value: unknown): RecurringRuleLabel[] {
  const labels = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(labels)) return []
  return labels.filter((label): label is RecurringRuleLabel => typeof label === 'object' && label !== null && 'id' in label && 'name' in label && typeof label.id === 'string' && typeof label.name === 'string')
}

async function withTransaction<T>(pool: Pool, callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await callback(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
