import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createFeedRepository } from './repository.js'

const sameTimestamp = new Date('2026-08-21T10:00:00.000Z')

const rowA = {
  kind: 'transaction' as const, id: 'aaaaaaaa-0000-4000-8000-000000000001',
  activity_date: '2026-08-21', created_at: sameTimestamp, amount_czk: '100', note: null,
  wallet_id: 'wallet-1', wallet_name: 'Účet', category_id: 'category-1', category_name: 'Jídlo',
  category_icon_key: 'utensils', category_color_key: 'orange', direction: 'expense' as const,
  source_wallet_id: null, source_wallet_name: null, destination_wallet_id: null, destination_wallet_name: null,
  adjustment_operation: null, recurring_rule_name: null, labels: [],
}
const rowB = {
  ...rowA,
  kind: 'transfer' as const, id: 'bbbbbbbb-0000-4000-8000-000000000002',
  wallet_id: null, wallet_name: null, category_id: null, category_name: null,
  category_icon_key: null, category_color_key: null, direction: null,
  source_wallet_id: 'wallet-1', source_wallet_name: 'Účet', destination_wallet_id: 'wallet-2', destination_wallet_name: 'Spoření',
}

const baseInput = { walletIds: null, dateFrom: null, dateTo: null, search: null, cursor: null, limit: 1 }

test('cursor pagination filter and ordering use the same full (activity_date, created_at, kind, id) tuple', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const repository = createFeedRepository({ query } as unknown as Pool)

  await repository.listFeed('user-1', { ...baseInput, cursor: encodeTestCursor() })

  const [sql] = query.mock.calls[0]
  const normalized = String(sql).replace(/\s+/g, ' ')
  expect(normalized).toContain('where (activity_date, created_at, kind, id) < ($3::date, $4::timestamptz, $5::text, $6::uuid)')
  expect(normalized).toContain('order by activity_date desc, created_at desc, kind desc, id desc')
})

test('two records sharing the same activity date and timestamp are still paginated deterministically by kind+id, not skipped or duplicated', async () => {
  // Page 1 (limit 1) returns rowA plus one extra row to prove a next page exists; the returned
  // cursor must carry rowA's own kind+id, not just its date/timestamp, or a concurrent insert
  // sharing that same date+timestamp could be skipped or duplicated across the page boundary.
  const query = vi.fn().mockResolvedValueOnce({ rows: [rowA, rowB] })
  const repository = createFeedRepository({ query } as unknown as Pool)

  const page1 = await repository.listFeed('user-1', baseInput)
  expect(page1.items).toHaveLength(1)
  expect(page1.items[0]?.id).toBe(rowA.id)
  expect(page1.nextCursor).not.toBeNull()

  query.mockResolvedValueOnce({ rows: [rowB] })
  await repository.listFeed('user-1', { ...baseInput, cursor: page1.nextCursor })

  const [, page2Values] = query.mock.calls[1]
  const values = page2Values as unknown[]
  // last 4 cursor params before the limit: activityDate, createdAt, kind, id
  const cursorValues = values.slice(-5, -1)
  expect(cursorValues).toEqual(['2026-08-21', sameTimestamp.toISOString(), 'transaction', rowA.id])
})

test('listFeed joins the recurring rule that generated a transaction or transfer, and maps its name through', async () => {
  const query = vi.fn().mockResolvedValueOnce({
    rows: [
      { ...rowA, recurring_rule_name: 'HBO' },
      { ...rowB, recurring_rule_name: 'Hypotéka' },
    ],
  })
  const repository = createFeedRepository({ query } as unknown as Pool)

  const page = await repository.listFeed('user-1', baseInput)

  const normalized = String(query.mock.calls[0][0]).replace(/\s+/g, ' ')
  expect(normalized).toContain('left join recurring_rule_occurrences occurrence')
  expect(normalized).toContain('left join recurring_rules recurring_rule')
  expect(page.items[0]).toMatchObject({ kind: 'transaction', recurringRuleName: 'HBO' })
})

test('a manually entered transaction with no originating recurring rule has a null recurringRuleName', async () => {
  const query = vi.fn().mockResolvedValueOnce({ rows: [rowA] })
  const repository = createFeedRepository({ query } as unknown as Pool)

  const page = await repository.listFeed('user-1', baseInput)

  expect(page.items[0]).toMatchObject({ recurringRuleName: null })
})

test('search matches a transaction or transfer by the name of the recurring rule that generated it, not just category/wallet/note/labels', async () => {
  const query = vi.fn().mockResolvedValueOnce({ rows: [] })
  const repository = createFeedRepository({ query } as unknown as Pool)

  await repository.listFeed('user-1', { ...baseInput, search: 'Oneplay' })

  const normalized = String(query.mock.calls[0][0]).replace(/\s+/g, ' ')
  expect(normalized).toContain('search_occurrence.transaction_id = t.id')
  expect(normalized).toContain('search_occurrence.transfer_id = tr.id')
  expect(normalized).toContain("search_recurring_rule.name ilike '%' || $3 || '%'")
})

function encodeTestCursor() {
  return Buffer.from(JSON.stringify({ activityDate: '2026-08-21', createdAt: sameTimestamp.toISOString(), kind: 'transaction', id: rowA.id })).toString('base64url')
}

test('getBounds finds the earliest date per table via order-by-limit-1, not a union-all scan with an outer min()', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [{ earliest_activity_date: '2025-01-01' }] })
  const repository = createFeedRepository({ query } as unknown as Pool)

  await repository.getBounds('user-1', { walletIds: null, categoryId: null, labelId: null })

  const [sql] = query.mock.calls[0]
  const normalized = String(sql).replace(/\s+/g, ' ')
  expect(normalized).toContain('order by t.transaction_date asc limit 1')
  expect(normalized).toContain('order by tr.transfer_date asc limit 1')
  expect(normalized).toContain('order by adjustment.adjustment_date asc limit 1')
  expect(normalized).not.toMatch(/union all[\s\S]*select min\(/i)
})

test('getBounds returns a null earliestActivityDate when there is no matching activity at all', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const repository = createFeedRepository({ query } as unknown as Pool)

  const result = await repository.getBounds('user-1', { walletIds: null, categoryId: null, labelId: null })

  expect(result).toEqual({ earliestActivityDate: null })
})
