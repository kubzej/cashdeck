// Repository tests run against a mocked `pg` pool: they check which queries and parameters the
// repository sends and how it handles the rows it is handed (transactions, cache invalidation,
// validation), never what Postgres would return. SQL correctness is not covered here.

import type { Pool } from 'pg'
import { beforeEach, expect, test, vi } from 'vitest'
import { invalidateWealthCache } from '../wealth-cache.js'
import type { RecurringRuleInput } from './domain.js'
import { createRecurringRuleRepository } from './repository.js'

vi.mock('../wealth-cache.js', () => ({ invalidateWealthCache: vi.fn() }))
beforeEach(() => vi.mocked(invalidateWealthCache).mockClear())

const baseInput: RecurringRuleInput = {
  name: 'Nájem',
  kind: 'transaction',
  amountCzk: 15000,
  walletId: 'wallet-1',
  categoryId: 'category-1',
  sourceWalletId: null,
  destinationWalletId: null,
  note: null,
  frequency: 'monthly',
  customIntervalDays: null,
  nextOccurrenceDate: '2026-02-28',
  endsOn: null,
  labelIds: [],
}

const ruleRow = {
  id: 'rule-1', name: 'Nájem', kind: 'transaction', amount_czk: '15000',
  transaction_wallet_id: 'wallet-1', transaction_wallet_name: 'Účet', category_id: 'category-1',
  category_name: 'Bydlení', category_icon_key: 'house', category_color_key: 'orange', category_direction: 'expense',
  source_wallet_id: null, source_wallet_name: null, destination_wallet_id: null, destination_wallet_name: null,
  note: null, frequency: 'monthly', custom_interval_days: null, status: 'active',
  schedule_anchor_date: '2026-01-31', next_occurrence_date: '2026-02-28', ends_on: null, sort_order: 0, labels: [],
}

test('editing a rule without changing its next occurrence date keeps the original schedule anchor', async () => {
  // The rule was originally anchored on the 31st; next_occurrence_date already drifted to the
  // 28th after passing through February. Only the rule's name is being edited here — the anchor
  // must stay 31st so March correctly resolves back to the 31st, not the 28th.
  const query = vi.fn()
    .mockResolvedValueOnce(undefined) // begin
    .mockResolvedValueOnce({ rows: [{ kind: 'transaction', next_occurrence_date: '2026-02-28', schedule_anchor_date: '2026-01-31', ends_on: null }] }) // current state
    .mockResolvedValueOnce({ rows: [{ id: 'rule-1' }] }) // update
    .mockResolvedValueOnce(undefined) // delete recurring_rule_labels
    .mockResolvedValueOnce({ rows: [] }) // materializeDueOccurrences: no due rules
    .mockResolvedValueOnce({ rows: [ruleRow] }) // requireRule
    .mockResolvedValueOnce(undefined) // commit
  const client = { query, release: vi.fn() }
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const repository = createRecurringRuleRepository(pool)

  await repository.updateRule('user-1', 'rule-1', { ...baseInput, name: 'Nájem bytu' }, '2026-01-01')

  const updateCall = query.mock.calls.find(([sql]) => String(sql).toLowerCase().includes('update recurring_rules'))
  expect(updateCall).toBeDefined()
  const [, values] = updateCall!
  // params: [userId, ruleId, name, kind, amountCzk, walletId, categoryId, sourceWalletId,
  //          destinationWalletId, note, frequency, customIntervalDays, scheduleAnchorDate, nextOccurrenceDate, endsOn]
  expect((values as unknown[])[12]).toBe('2026-01-31')
  expect((values as unknown[])[13]).toBe('2026-02-28')
})

test('moving the next occurrence date to a new date re-anchors the schedule', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce(undefined) // begin
    .mockResolvedValueOnce({ rows: [{ kind: 'transaction', next_occurrence_date: '2026-02-28', schedule_anchor_date: '2026-01-31', ends_on: null }] }) // current state
    .mockResolvedValueOnce({ rows: [{ id: 'rule-1' }] }) // update
    .mockResolvedValueOnce(undefined) // delete recurring_rule_labels
    .mockResolvedValueOnce({ rows: [] }) // materializeDueOccurrences
    .mockResolvedValueOnce({ rows: [ruleRow] }) // requireRule
    .mockResolvedValueOnce(undefined) // commit
  const client = { query, release: vi.fn() }
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const repository = createRecurringRuleRepository(pool)

  await repository.updateRule('user-1', 'rule-1', { ...baseInput, nextOccurrenceDate: '2026-03-15' }, '2026-01-01')

  const updateCall = query.mock.calls.find(([sql]) => String(sql).toLowerCase().includes('update recurring_rules'))
  const [, values] = updateCall!
  expect((values as unknown[])[12]).toBe('2026-03-15')
  expect((values as unknown[])[13]).toBe('2026-03-15')
})

test('rejects changing a rule\'s kind from transaction to transfer (or vice versa)', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce(undefined) // begin
    .mockResolvedValueOnce({ rows: [{ kind: 'transaction', next_occurrence_date: '2026-02-28', schedule_anchor_date: '2026-01-31', ends_on: null }] }) // current state
    .mockResolvedValueOnce(undefined) // rollback
  const client = { query, release: vi.fn() }
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const repository = createRecurringRuleRepository(pool)

  await expect(repository.updateRule('user-1', 'rule-1', {
    ...baseInput, kind: 'transfer', walletId: null, categoryId: null, sourceWalletId: 'wallet-1', destinationWalletId: 'wallet-2',
  }, '2026-01-01')).rejects.toMatchObject({ statusCode: 400, message: 'Typ opakování nelze po vytvoření změnit.' })

  const updateCall = query.mock.calls.find(([sql]) => String(sql).toLowerCase().includes('update recurring_rules'))
  expect(updateCall).toBeUndefined()
})

test('rejects moving an active rule\'s next occurrence date into the past via the real update flow, not just the isolated validator', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce(undefined) // begin
    .mockResolvedValueOnce({ rows: [{ kind: 'transaction', next_occurrence_date: '2026-02-28', schedule_anchor_date: '2026-01-31', ends_on: null }] }) // current state
    .mockResolvedValueOnce(undefined) // rollback
  const client = { query, release: vi.fn() }
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const repository = createRecurringRuleRepository(pool)

  await expect(repository.updateRule('user-1', 'rule-1', { ...baseInput, nextOccurrenceDate: '2025-12-01' }, '2026-01-01'))
    .rejects.toMatchObject({ statusCode: 400, message: 'Další výskyt musí být dnes nebo v budoucnu.' })

  const updateCall = query.mock.calls.find(([sql]) => String(sql).toLowerCase().includes('update recurring_rules'))
  expect(updateCall).toBeUndefined()
  expect(query).toHaveBeenCalledWith('rollback')
})

test('generateDue processes each due rule in its own transaction, so one rule failing does not roll back another rule already committed in the same run', async () => {
  const poolQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: 'rule-a' }, { id: 'rule-b' }] }) // due rule ids listing

  const clientA = {
    query: vi.fn()
      .mockResolvedValueOnce(undefined) // begin
      .mockResolvedValueOnce({ rows: [] }) // materializeDueOccurrences: nothing actually due for rule-a
      .mockResolvedValueOnce(undefined), // commit
    release: vi.fn(),
  }
  const clientB = {
    query: vi.fn()
      .mockResolvedValueOnce(undefined) // begin
      .mockRejectedValueOnce(new Error('connection reset')) // materializeDueOccurrences select fails for rule-b
      .mockResolvedValueOnce(undefined), // rollback
    release: vi.fn(),
  }
  const connect = vi.fn().mockResolvedValueOnce(clientA).mockResolvedValueOnce(clientB)
  const pool = { query: poolQuery, connect } as unknown as Pool
  const repository = createRecurringRuleRepository(pool)

  const result = await repository.generateDue('2026-03-01')

  expect(connect).toHaveBeenCalledTimes(2)
  expect(clientA.query).toHaveBeenCalledWith('commit')
  expect(clientB.query).toHaveBeenCalledWith('rollback')
  expect(clientB.query).not.toHaveBeenCalledWith('commit')
  expect(result.failures).toEqual([{ ruleId: 'rule-b', message: 'connection reset' }])
  expect(result.processedRules).toBe(0)
  expect(invalidateWealthCache).not.toHaveBeenCalled()
})

test('reorderRules writes each rule\'s new sort_order by its position in the given list', async () => {
  const client = {
    query: vi.fn()
      .mockResolvedValueOnce(undefined) // begin
      .mockResolvedValueOnce({ rows: [{ id: 'rule-a' }, { id: 'rule-b' }] }) // current ids, locked
      .mockResolvedValueOnce(undefined) // update rule-b -> 0
      .mockResolvedValueOnce(undefined) // update rule-a -> 1
      .mockResolvedValueOnce(undefined), // commit
    release: vi.fn(),
  }
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const repository = createRecurringRuleRepository(pool)

  await repository.reorderRules('user-1', ['rule-b', 'rule-a'])

  expect(client.query).toHaveBeenNthCalledWith(3, expect.stringContaining('update recurring_rules set sort_order'), ['user-1', 'rule-b', 0])
  expect(client.query).toHaveBeenNthCalledWith(4, expect.stringContaining('update recurring_rules set sort_order'), ['user-1', 'rule-a', 1])
})

test('reorderRules rejects a stale or incomplete rule id set without writing anything', async () => {
  const client = {
    query: vi.fn()
      .mockResolvedValueOnce(undefined) // begin
      .mockResolvedValueOnce({ rows: [{ id: 'rule-a' }, { id: 'rule-b' }] }) // current ids, locked
      .mockResolvedValueOnce(undefined), // rollback
    release: vi.fn(),
  }
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const repository = createRecurringRuleRepository(pool)

  await expect(repository.reorderRules('user-1', ['rule-a'])).rejects.toMatchObject({
    statusCode: 409,
    message: 'Pořadí opakování neodpovídá aktuálním datům.',
  })

  const writeCalls = client.query.mock.calls.filter(([sql]) => String(sql).toLowerCase().includes('set sort_order'))
  expect(writeCalls).toHaveLength(0)
  expect(client.query).toHaveBeenCalledWith('rollback')
})

function createRuleClient(dueRows: unknown[]) {
  const query = vi.fn(async (sql: string) => {
    const normalized = sql.toLowerCase()
    if (normalized.includes('insert into recurring_rules')) return { rows: [{ id: 'rule-1' }] }
    if (normalized.includes('from recurring_rules') && normalized.includes('for update skip locked')) return { rows: dueRows }
    if (normalized.includes('select exists')) return { rows: [{ exists: false }] }
    if (normalized.includes('insert into transactions')) return { rows: [{ id: 'transaction-1' }] }
    if (normalized.includes('r.user_id = $1 and r.id = $2')) return { rows: [ruleRow] }
    return { rows: [] }
  })
  return { query, release: vi.fn() }
}

const dueRuleRow = {
  id: 'rule-1', user_id: 'user-1', kind: 'transaction', amount_czk: '15000', transaction_wallet_id: 'wallet-1', category_id: 'category-1',
  source_wallet_id: null, destination_wallet_id: null, note: null, frequency: 'monthly', custom_interval_days: null,
  schedule_anchor_date: '2026-02-28', next_occurrence_date: '2026-02-28', ends_on: null,
}

test('creating a rule that is due today invalidates the wealth cache only after the transaction commits', async () => {
  const client = createRuleClient([dueRuleRow])
  const repository = createRecurringRuleRepository({ connect: vi.fn().mockResolvedValue(client) } as unknown as Pool)

  await repository.createRule('user-1', baseInput, '2026-02-28')

  expect(client.query.mock.calls.some(([sql]) => sql.toLowerCase().includes('insert into transactions'))).toBe(true)
  expect(invalidateWealthCache).toHaveBeenCalledTimes(1)
  const commitOrder = client.query.mock.invocationCallOrder[client.query.mock.calls.findIndex(([sql]) => sql === 'commit')]
  expect(vi.mocked(invalidateWealthCache).mock.invocationCallOrder[0]).toBeGreaterThan(commitOrder!)
})

test('creating a rule with nothing due yet leaves the wealth cache alone', async () => {
  const client = createRuleClient([])
  const repository = createRecurringRuleRepository({ connect: vi.fn().mockResolvedValue(client) } as unknown as Pool)

  await repository.createRule('user-1', { ...baseInput, nextOccurrenceDate: '2026-03-28' }, '2026-02-28')

  expect(invalidateWealthCache).not.toHaveBeenCalled()
})

test('generateDue creates the due occurrence, advances the rule and invalidates the wealth cache once it is committed', async () => {
  const dueRule = {
    id: 'rule-a', user_id: 'user-1', kind: 'transaction', amount_czk: '15000', transaction_wallet_id: 'wallet-1', category_id: 'category-1',
    source_wallet_id: null, destination_wallet_id: null, note: null, frequency: 'monthly', custom_interval_days: null,
    schedule_anchor_date: '2026-02-15', next_occurrence_date: '2026-02-15', ends_on: null,
  }
  const calls: { sql: string; params: unknown[] }[] = []
  const client = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      const normalized = sql.replace(/\s+/g, ' ')
      calls.push({ sql: normalized, params })
      if (normalized.startsWith('select id, user_id, kind')) return { rows: [dueRule] }
      if (normalized.includes('select exists(')) return { rows: [{ exists: false }] }
      if (normalized.startsWith('insert into transactions')) return { rows: [{ id: 'transaction-1' }] }
      return { rows: [] }
    }),
    release: vi.fn(),
  }
  const pool = { query: vi.fn().mockResolvedValue({ rows: [{ id: 'rule-a' }] }), connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const repository = createRecurringRuleRepository(pool)

  const result = await repository.generateDue('2026-03-01')

  expect(result).toEqual({ processedRules: 1, generatedTransactions: 1, generatedTransfers: 0, failures: [] })
  const insert = calls.find((call) => call.sql.startsWith('insert into transactions'))
  expect(insert?.params).toEqual(['user-1', 'wallet-1', 'category-1', '15000', '2026-02-15', null])
  const advance = calls.find((call) => call.sql.startsWith('update recurring_rules'))
  expect(advance?.params).toEqual(['user-1', 'rule-a', '2026-03-15', 'active'])
  expect(client.query).toHaveBeenCalledWith('commit')
  expect(invalidateWealthCache).toHaveBeenCalledTimes(1)
})
