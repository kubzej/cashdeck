import type { Pool } from 'pg'
import { calculateTransferImpactCzk } from '../feed/domain.js'
import {
  getPlannedRange,
  projectRecurringRules,
  sortPlannedItems,
  summarizePlanned,
  type PlannedItem,
  type PlannedLabel,
  type PlannedListInput,
  type PlannedListResult,
  type PlannedTransaction,
  type PlannedTransfer,
  type RecurringProjectionRule,
} from './domain.js'

export type PlannedRepository = {
  listPlanned(userId: string, input: PlannedListInput): Promise<PlannedListResult>
}

type ManualTransactionRow = {
  id: string
  wallet_id: string
  wallet_name: string
  category_id: string
  category_name: string
  category_icon_key: string
  category_color_key: string
  direction: 'income' | 'expense'
  amount_czk: string
  transaction_date: string
  note: string | null
  labels: unknown
}

type ManualTransferRow = {
  id: string
  source_wallet_id: string
  source_wallet_name: string
  destination_wallet_id: string
  destination_wallet_name: string
  amount_czk: string
  transfer_date: string
  note: string | null
  labels: unknown
}

type RecurringRuleRow = {
  id: string
  name: string
  kind: 'transaction' | 'transfer'
  amount_czk: string
  wallet_id: string | null
  wallet_name: string | null
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
  frequency: RecurringProjectionRule['frequency']
  custom_interval_days: number | null
  schedule_anchor_date: string
  next_occurrence_date: string
  ends_on: string | null
  labels: unknown
}

export function createPlannedRepository(pool: Pool): PlannedRepository {
  return {
    async listPlanned(userId, input) {
      const range = getPlannedRange(input)
      if (range.dateFrom > range.dateTo) return { items: [], summary: { count: 0, totalCzk: 0 } }

      const [transactions, transfers, recurringRules] = await Promise.all([
        listManualTransactions(pool, userId, range.dateFrom, range.dateTo, input.walletIds),
        listManualTransfers(pool, userId, range.dateFrom, range.dateTo, input.walletIds),
        listRecurringProjectionRules(pool, userId, range.dateFrom, range.dateTo, input.walletIds),
      ])

      const manualItems: PlannedItem[] = [
        ...transactions.map(toManualTransaction),
        ...transfers.map((row) => toManualTransfer(row, input.walletIds)),
      ]
      const items = sortPlannedItems([
        ...manualItems,
        ...projectRecurringRules(recurringRules.map(toRecurringProjectionRule), input),
      ])
      return { items, summary: summarizePlanned(items) }
    },
  }
}

async function listManualTransactions(pool: Pool, userId: string, dateFrom: string, dateTo: string, walletIds: string[] | null) {
  const values: unknown[] = [userId, dateFrom, dateTo]
  const walletFilter = walletIds ? `and wallet.id = any($${values.push(walletIds)}::uuid[])` : ''
  const result = await pool.query<ManualTransactionRow>(`
    select t.id, t.wallet_id, wallet.name as wallet_name, t.category_id,
      category.name as category_name, category.icon_key as category_icon_key,
      category.color_key as category_color_key, category.direction, t.amount_czk,
      to_char(t.transaction_date, 'YYYY-MM-DD') as transaction_date, t.note,
      coalesce(
        json_agg(json_build_object('id', label.id, 'name', label.name) order by label.normalized_name asc, label.id asc)
          filter (where label.id is not null),
        '[]'::json
      ) as labels
    from transactions t
    join wallets wallet on wallet.user_id = t.user_id and wallet.id = t.wallet_id
    join categories category on category.user_id = t.user_id and category.id = t.category_id
    left join transaction_labels transaction_label on transaction_label.user_id = t.user_id and transaction_label.transaction_id = t.id
    left join labels label on label.user_id = t.user_id and label.id = transaction_label.label_id
    where t.user_id = $1
      and not wallet.is_hidden
      and t.transaction_date between $2::date and $3::date
      ${walletFilter}
    group by t.id, t.wallet_id, wallet.name, t.category_id, category.name, category.icon_key, category.color_key, category.direction
  `, values)
  return result.rows
}

async function listManualTransfers(pool: Pool, userId: string, dateFrom: string, dateTo: string, walletIds: string[] | null) {
  const values: unknown[] = [userId, dateFrom, dateTo]
  const walletFilter = walletIds ? `and (source_wallet.id = any($${values.push(walletIds)}::uuid[]) or destination_wallet.id = any($${values.length}::uuid[]))` : ''
  const result = await pool.query<ManualTransferRow>(`
    select tr.id, tr.source_wallet_id, source_wallet.name as source_wallet_name,
      tr.destination_wallet_id, destination_wallet.name as destination_wallet_name,
      tr.amount_czk, to_char(tr.transfer_date, 'YYYY-MM-DD') as transfer_date, tr.note,
      coalesce(
        json_agg(json_build_object('id', label.id, 'name', label.name) order by label.normalized_name asc, label.id asc)
          filter (where label.id is not null),
        '[]'::json
      ) as labels
    from transfers tr
    join wallets source_wallet on source_wallet.user_id = tr.user_id and source_wallet.id = tr.source_wallet_id
    join wallets destination_wallet on destination_wallet.user_id = tr.user_id and destination_wallet.id = tr.destination_wallet_id
    left join transfer_labels transfer_label on transfer_label.user_id = tr.user_id and transfer_label.transfer_id = tr.id
    left join labels label on label.user_id = tr.user_id and label.id = transfer_label.label_id
    where tr.user_id = $1
      and not source_wallet.is_hidden
      and not destination_wallet.is_hidden
      and tr.transfer_date between $2::date and $3::date
      ${walletFilter}
    group by tr.id, tr.source_wallet_id, source_wallet.name, tr.destination_wallet_id, destination_wallet.name
  `, values)
  return result.rows
}

async function listRecurringProjectionRules(pool: Pool, userId: string, dateFrom: string, dateTo: string, walletIds: string[] | null) {
  const values: unknown[] = [userId, dateFrom, dateTo]
  const walletFilter = walletIds ? `and (
    (r.kind = 'transaction' and transaction_wallet.id = any($${values.push(walletIds)}::uuid[]))
    or (r.kind = 'transfer' and (source_wallet.id = any($${values.length}::uuid[]) or destination_wallet.id = any($${values.length}::uuid[])))
  )` : ''
  const result = await pool.query<RecurringRuleRow>(`
    select r.id, r.name, r.kind, r.amount_czk,
      r.transaction_wallet_id as wallet_id, transaction_wallet.name as wallet_name,
      r.category_id, category.name as category_name, category.icon_key as category_icon_key,
      category.color_key as category_color_key, category.direction as category_direction,
      r.source_wallet_id, source_wallet.name as source_wallet_name,
      r.destination_wallet_id, destination_wallet.name as destination_wallet_name,
      r.note, r.frequency, r.custom_interval_days,
      to_char(r.schedule_anchor_date, 'YYYY-MM-DD') as schedule_anchor_date,
      to_char(r.next_occurrence_date, 'YYYY-MM-DD') as next_occurrence_date,
      to_char(r.ends_on, 'YYYY-MM-DD') as ends_on,
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
    where r.user_id = $1
      and r.status = 'active'::recurring_rule_status
      and r.next_occurrence_date <= $3::date
      and (r.ends_on is null or r.ends_on >= $2::date)
      and (
        (r.kind = 'transaction' and transaction_wallet.is_hidden is false)
        or (r.kind = 'transfer' and source_wallet.is_hidden is false and destination_wallet.is_hidden is false)
      )
      ${walletFilter}
    group by r.id, r.name, r.kind, r.amount_czk, r.transaction_wallet_id, transaction_wallet.name,
      r.category_id, category.name, category.icon_key, category.color_key, category.direction,
      r.source_wallet_id, source_wallet.name, r.destination_wallet_id, destination_wallet.name,
      r.note, r.frequency, r.custom_interval_days, r.schedule_anchor_date, r.next_occurrence_date, r.ends_on
  `, values)
  return result.rows
}

function toManualTransaction(row: ManualTransactionRow): PlannedTransaction {
  return {
    kind: 'transaction', origin: 'manual', id: row.id, recurringRuleId: null, recurringRuleName: null,
    walletId: row.wallet_id, walletName: row.wallet_name, categoryId: row.category_id, categoryName: row.category_name,
    categoryIconKey: row.category_icon_key, categoryColorKey: row.category_color_key, direction: row.direction,
    amountCzk: Number(row.amount_czk), transactionDate: row.transaction_date, note: row.note, labels: parseLabels(row.labels),
  }
}

function toManualTransfer(row: ManualTransferRow, selectedWalletIds: string[] | null): PlannedTransfer {
  const amountCzk = Number(row.amount_czk)
  return {
    kind: 'transfer', origin: 'manual', id: row.id, recurringRuleId: null, recurringRuleName: null,
    sourceWalletId: row.source_wallet_id, sourceWalletName: row.source_wallet_name,
    destinationWalletId: row.destination_wallet_id, destinationWalletName: row.destination_wallet_name,
    amountCzk, impactCzk: calculateTransferImpactCzk({ amountCzk, sourceWalletId: row.source_wallet_id, destinationWalletId: row.destination_wallet_id, selectedWalletIds }),
    transferDate: row.transfer_date, note: row.note, labels: parseLabels(row.labels),
  }
}

function toRecurringProjectionRule(row: RecurringRuleRow): RecurringProjectionRule {
  return {
    id: row.id, name: row.name, kind: row.kind, amountCzk: Number(row.amount_czk),
    walletId: row.wallet_id, walletName: row.wallet_name, categoryId: row.category_id, categoryName: row.category_name,
    categoryIconKey: row.category_icon_key, categoryColorKey: row.category_color_key, categoryDirection: row.category_direction,
    sourceWalletId: row.source_wallet_id, sourceWalletName: row.source_wallet_name,
    destinationWalletId: row.destination_wallet_id, destinationWalletName: row.destination_wallet_name,
    note: row.note, labels: parseLabels(row.labels), frequency: row.frequency,
    customIntervalDays: row.custom_interval_days, scheduleAnchorDate: row.schedule_anchor_date,
    nextOccurrenceDate: row.next_occurrence_date, endsOn: row.ends_on,
  }
}

function parseLabels(value: unknown): PlannedLabel[] {
  const labels = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(labels)) return []
  return labels.filter((label): label is PlannedLabel => typeof label === 'object' && label !== null && 'id' in label && 'name' in label && typeof label.id === 'string' && typeof label.name === 'string')
}
