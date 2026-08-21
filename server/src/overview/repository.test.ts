import type { Pool } from 'pg'
import { afterEach, expect, test, vi } from 'vitest'
import { createOverviewRepository } from './repository.js'

afterEach(() => vi.useRealTimers())

test('caps overview aggregates at today and never loads recurring forecasts', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-21T12:00:00+02:00'))
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ earliest_activity_date: '2025-01-01' }] })
    .mockResolvedValueOnce({ rows: [{ wealth_czk: '428600', change_czk: '21400' }] })
    .mockResolvedValueOnce({ rows: [{ income_czk: '74500', expense_czk: '53100' }] })
    .mockResolvedValueOnce({ rows: [{ bucket_date: '2026-08-21', value_czk: '428600' }] })
    .mockResolvedValueOnce({ rows: [{ bucket_date: '2026-08-21', income_czk: '74500', expense_czk: '53100' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
  const repository = createOverviewRepository({ query } as unknown as Pool)

  const result = await repository.getOverview('user-1', {
    walletIds: null,
    period: 'month',
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
  })

  expect(query).toHaveBeenCalledTimes(7)
  for (const [, parameters] of query.mock.calls.slice(1)) {
    expect(parameters).toEqual(['user-1', null, '2026-08-01', '2026-08-21'])
  }
  expect(query.mock.calls.some(([sql]) => String(sql).includes('recurring_rules'))).toBe(false)
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
    .mockResolvedValueOnce({ rows: [{ wealth_czk: '100000', change_czk: '5000' }] })
    .mockResolvedValueOnce({ rows: [{ income_czk: '5000', expense_czk: '0' }] })
    .mockResolvedValueOnce({ rows: [{ bucket_date: '2026-03-31', value_czk: '100000' }] })
    .mockResolvedValueOnce({ rows: [{ bucket_date: '2026-03-31', income_czk: '5000', expense_czk: '0' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
  const repository = createOverviewRepository({ query } as unknown as Pool)

  const result = await repository.getOverview('user-1', {
    walletIds: null,
    period: 'month',
    dateFrom: '2026-03-01',
    dateTo: '2026-03-31',
  })

  expect(result.range).toEqual({ dateFrom: '2026-03-01', dateTo: '2026-03-31', earliestActivityDate: '2025-01-01', granularity: 'day' })
  for (const [, parameters] of query.mock.calls.slice(1)) {
    expect(parameters).toEqual(['user-1', null, '2026-03-01', '2026-03-31'])
  }
  const [wealthSql] = query.mock.calls[1]
  expect(String(wealthSql)).toContain('event_date <= $4::date')
  expect(result.wealth.amountCzk).toBe(100_000)
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
  })

  expect(query).toHaveBeenCalledTimes(2)
  for (const [, parameters] of query.mock.calls) {
    expect(parameters).toEqual(['user-1', null, '2026-08-01', '2026-08-02', 'category-1'])
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
  })

  const [previousSql] = query.mock.calls[0]
  expect(String(previousSql)).toContain('transaction_labels')
  expect(String(previousSql)).not.toContain('category_id = $5')
})
