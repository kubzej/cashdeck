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
  schedule_anchor_date: '2026-01-31', next_occurrence_date: '2026-02-28', ends_on: null, labels: [],
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
  expect(result.failedRuleIds).toEqual(['rule-b'])
  expect(result.processedRules).toBe(0)
  expect(invalidateWealthCache).not.toHaveBeenCalled()
})
