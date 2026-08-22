import type { Pool } from 'pg'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { resetWealthCacheForTests } from '../wealth-cache.js'
import { createOverviewRepository } from './repository.js'

beforeEach(() => resetWealthCacheForTests())
afterEach(() => vi.useRealTimers())

test('caps overview aggregates at today and never loads recurring forecasts', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-21T12:00:00+02:00'))
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ earliest_activity_date: '2025-01-01' }] })
    .mockResolvedValueOnce({ rows: [{ wealth_czk: '428600', change_czk: '21400', series: [{ date: '2026-08-21', value_czk: 428600 }] }] })
    .mockResolvedValueOnce({ rows: [{ income_czk: '74500', expense_czk: '53100' }] })
    .mockResolvedValueOnce({ rows: [{ bucket_date: '2026-08-21', income_czk: '74500', expense_czk: '53100' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
  const repository = createOverviewRepository({ query } as unknown as Pool)

  const result = await repository.getOverview('user-1', {
    walletIds: null,
    period: 'month',
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    search: null,
  })

  expect(query).toHaveBeenCalledTimes(6)
  // wealth (call 1) only references $1-$4 — passing it a 5th (search) parameter would make
  // Postgres reject the bind. flow/flowSeries/categories/labels (calls 2-5) reference $5 too.
  expect(query.mock.calls[1][1]).toEqual(['user-1', null, '2026-08-01', '2026-08-21'])
  for (const [, parameters] of query.mock.calls.slice(2)) {
    expect(parameters).toEqual(['user-1', null, '2026-08-01', '2026-08-21', null])
  }
  // Only the bounds/wealth queries (calls 0-1) must stay forecast-free — they decide the account
  // balance shown to the user. flow/categories/labels (calls 2-5) legitimately reference
  // recurring_rules now, to match search text against the rule that generated a transaction; that
  // join is still bounded by the same real, already-materialized transaction_date range.
  expect(query.mock.calls.slice(0, 2).some(([sql]) => String(sql).includes('recurring_rules'))).toBe(false)
  expect(result.range).toEqual({ dateFrom: '2026-08-01', dateTo: '2026-08-21', earliestActivityDate: '2025-01-01', granularity: 'day' })
  expect(result.wealth).toEqual({ amountCzk: 428_600, changeCzk: 21_400 })
  expect(result.flow).toEqual({ incomeCzk: 74_500, expenseCzk: 53_100, cashflowCzk: 21_400 })
})

test('shows a past period\'s own ending balance, not today\'s — a later transaction never leaks into it', async () => {
  // "Today" is August, but the browsed period is March: dateTo must stay March 31st (never get
  // clamped up to today), and the wealth SQL must bound by that exact date, not by "today".
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-21T12:00:00+02:00'))
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ earliest_activity_date: '2025-01-01' }] })
    .mockResolvedValueOnce({ rows: [{ wealth_czk: '100000', change_czk: '5000', series: [{ date: '2026-03-31', value_czk: 100000 }] }] })
    .mockResolvedValueOnce({ rows: [{ income_czk: '5000', expense_czk: '0' }] })
    .mockResolvedValueOnce({ rows: [{ bucket_date: '2026-03-31', income_czk: '5000', expense_czk: '0' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
  const repository = createOverviewRepository({ query } as unknown as Pool)

  const result = await repository.getOverview('user-1', {
    walletIds: null,
    period: 'month',
    dateFrom: '2026-03-01',
    dateTo: '2026-03-31',
    search: null,
  })

  expect(result.range).toEqual({ dateFrom: '2026-03-01', dateTo: '2026-03-31', earliestActivityDate: '2025-01-01', granularity: 'day' })
  expect(query.mock.calls[1][1]).toEqual(['user-1', null, '2026-03-01', '2026-03-31'])
  for (const [, parameters] of query.mock.calls.slice(2)) {
    expect(parameters).toEqual(['user-1', null, '2026-03-01', '2026-03-31', null])
  }
  const [wealthSql] = query.mock.calls[1]
  expect(String(wealthSql)).toContain('event_date <= $4::date')
  expect(result.wealth.amountCzk).toBe(100_000)
})

test('search filters flow, its bucketed series, categories, and the transaction side of labels — by category/wallet name, note, tagged labels, and the originating recurring rule\'s name', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-21T12:00:00+02:00'))
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ earliest_activity_date: '2025-01-01' }] })
    .mockResolvedValueOnce({ rows: [{ wealth_czk: '0', change_czk: '0', series: [] }] })
    .mockResolvedValueOnce({ rows: [{ income_czk: '0', expense_czk: '698' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
  const repository = createOverviewRepository({ query } as unknown as Pool)

  const result = await repository.getOverview('user-1', { walletIds: null, period: 'month', dateFrom: '2026-08-01', dateTo: '2026-08-31', search: 'Oneplay' })

  expect(query.mock.calls[1][1]).toEqual(['user-1', null, '2026-08-01', '2026-08-21'])
  for (const [, parameters] of query.mock.calls.slice(2)) {
    expect(parameters).toEqual(['user-1', null, '2026-08-01', '2026-08-21', 'Oneplay'])
  }
  const [flowSql] = query.mock.calls[2]
  const normalized = String(flowSql).replace(/\s+/g, ' ')
  expect(normalized).toContain('search_category.name')
  expect(normalized).toContain('search_wallet.name')
  expect(normalized).toContain("search_recurring_rule.name ilike '%' || $5 || '%'")
  const [labelsSql] = query.mock.calls[5]
  expect(String(labelsSql).replace(/\s+/g, ' ')).toContain('search_recurring_rule')
  expect(result.flow).toEqual({ incomeCzk: 0, expenseCzk: 698, cashflowCzk: -698 })
})

test('a null search leaves the flow/category/label queries unfiltered — the search predicate is a no-op, not a missing-parameter crash', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-21T12:00:00+02:00'))
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ earliest_activity_date: '2025-01-01' }] })
    .mockResolvedValueOnce({ rows: [{ wealth_czk: '0', change_czk: '0', series: [] }] })
    .mockResolvedValueOnce({ rows: [{ income_czk: '52000', expense_czk: '18500' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
  const repository = createOverviewRepository({ query } as unknown as Pool)

  const result = await repository.getOverview('user-1', { walletIds: null, period: 'month', dateFrom: '2026-08-01', dateTo: '2026-08-31', search: null })

  const [flowSql] = query.mock.calls[2]
  expect(String(flowSql)).toContain('$5::text is null or')
  expect(result.flow).toEqual({ incomeCzk: 52_000, expenseCzk: 18_500, cashflowCzk: 33_500 })
})

test('computes a category selection\'s previous-period total and bucketed series for the exact filtered window', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ amount_czk: '-9000' }] })
    .mockResolvedValueOnce({ rows: [{ bucket_date: '2026-08-01', amount_czk: '-3000' }, { bucket_date: '2026-08-02', amount_czk: '0' }] })
  const repository = createOverviewRepository({ query } as unknown as Pool)

  const result = await repository.getSelectionTrend('user-1', {
    type: 'category',
    id: 'category-1',
    walletIds: null,
    dateFrom: '2026-08-01',
    dateTo: '2026-08-02',
    granularity: 'day',
    search: null,
  })

  expect(query).toHaveBeenCalledTimes(2)
  for (const [, parameters] of query.mock.calls) {
    expect(parameters).toEqual(['user-1', null, '2026-08-01', '2026-08-02', 'category-1', null])
  }
  const [previousSql] = query.mock.calls[0]
  expect(String(previousSql)).toContain('t.category_id = $5::uuid')
  expect(String(previousSql)).toContain('previous_from')
  expect(result.previous).toEqual({ amountCzk: -9_000 })
  expect(result.series).toEqual([{ date: '2026-08-01', amountCzk: -3_000 }, { date: '2026-08-02', amountCzk: 0 }])
})

test('filters a label selection by tagged transactions instead of category id', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ amount_czk: '0' }] })
    .mockResolvedValueOnce({ rows: [] })
  const repository = createOverviewRepository({ query } as unknown as Pool)

  await repository.getSelectionTrend('user-1', {
    type: 'label',
    id: 'label-1',
    walletIds: ['wallet-1'],
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    granularity: 'day',
    search: null,
  })

  const [previousSql] = query.mock.calls[0]
  expect(String(previousSql)).toContain('transaction_labels')
  expect(String(previousSql)).not.toContain('category_id = $5')
})

test('type "total" filters by nothing but the wallet/date/search scope — same everything-included trend the headline total gets, no category/label id required', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ amount_czk: '33500' }] })
    .mockResolvedValueOnce({ rows: [{ bucket_date: '2026-08-01', amount_czk: '10000' }] })
  const repository = createOverviewRepository({ query } as unknown as Pool)

  const result = await repository.getSelectionTrend('user-1', {
    type: 'total',
    id: null,
    walletIds: null,
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    granularity: 'day',
    search: null,
  })

  for (const [, parameters] of query.mock.calls) {
    expect(parameters).toEqual(['user-1', null, '2026-08-01', '2026-08-31', null, null])
  }
  const [previousSql] = query.mock.calls[0]
  const normalized = String(previousSql).replace(/\s+/g, ' ')
  // Always true, but still casts $5 so Postgres can type an otherwise-unreferenced placeholder —
  // omitting the cast entirely fails against real Postgres with "could not determine data type".
  expect(normalized).toContain('($5::uuid is null or true)')
  expect(normalized).not.toContain('category_id = $5')
  expect(normalized).not.toContain('tl.label_id = $5')
  expect(result.previous).toEqual({ amountCzk: 33_500 })
})

test('a selection trend combined with search text is filtered by both — the previous-period total and series stay consistent with a search-filtered headline amount', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ amount_czk: '-9000' }] })
    .mockResolvedValueOnce({ rows: [] })
  const repository = createOverviewRepository({ query } as unknown as Pool)

  await repository.getSelectionTrend('user-1', {
    type: 'category',
    id: 'category-1',
    walletIds: null,
    dateFrom: '2026-08-01',
    dateTo: '2026-08-02',
    granularity: 'day',
    search: 'Oneplay',
  })

  for (const [, parameters] of query.mock.calls) {
    expect(parameters).toEqual(['user-1', null, '2026-08-01', '2026-08-02', 'category-1', 'Oneplay'])
  }
  const [previousSql] = query.mock.calls[0]
  const normalized = String(previousSql).replace(/\s+/g, ' ')
  expect(normalized).toContain('t.category_id = $5::uuid')
  expect(normalized).toContain("search_recurring_rule.name ilike '%' || $6 || '%'")
})
