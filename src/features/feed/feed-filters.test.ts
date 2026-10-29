import { expect, test } from 'vitest'
import { createDefaultFeedFilters, resolveFeedDateRange, shiftFeedPeriod } from './feed-filters'

test('moving by month from the 29th–31st lands on the adjacent month, never the same or a skipped one', () => {
  expect(shiftFeedPeriod('2026-10-31', 'month', -1)).toBe('2026-09-01')
  expect(shiftFeedPeriod('2026-10-31', 'month', 1)).toBe('2026-11-01')
  expect(shiftFeedPeriod('2026-03-31', 'month', -1)).toBe('2026-02-01')
  expect(shiftFeedPeriod('2024-02-29', 'month', -1)).toBe('2024-01-01')
  expect(shiftFeedPeriod('2024-02-29', 'month', 1)).toBe('2024-03-01')
})

test('moving by month crosses year boundaries in both directions', () => {
  expect(shiftFeedPeriod('2026-01-31', 'month', -1)).toBe('2025-12-01')
  expect(shiftFeedPeriod('2026-12-31', 'month', 1)).toBe('2027-01-01')
})

test('repeated month steps from the 31st visit every month in order', () => {
  let anchor = '2026-10-31'
  const visited: string[] = []
  for (let step = 0; step < 5; step += 1) {
    anchor = shiftFeedPeriod(anchor, 'month', 1)
    visited.push(anchor.slice(0, 7))
  }
  expect(visited).toEqual(['2026-11', '2026-12', '2027-01', '2027-02', '2027-03'])
})

test('week and year steps keep the day', () => {
  expect(shiftFeedPeriod('2026-10-27', 'week', -1)).toBe('2026-10-20')
  expect(shiftFeedPeriod('2026-10-27', 'week', 1)).toBe('2026-11-03')
  expect(shiftFeedPeriod('2026-10-27', 'year', 1)).toBe('2027-10-27')
})

const base = createDefaultFeedFilters()

test('a week runs Monday to Sunday, wherever in the week the anchor falls', () => {
  for (const anchor of ['2026-08-17', '2026-08-20', '2026-08-23']) {
    expect(resolveFeedDateRange({ ...base, period: 'week', periodAnchor: anchor })).toEqual({ dateFrom: '2026-08-17', dateTo: '2026-08-23' })
  }
})

test('a week can span two months and two years', () => {
  expect(resolveFeedDateRange({ ...base, period: 'week', periodAnchor: '2026-09-01' })).toEqual({ dateFrom: '2026-08-31', dateTo: '2026-09-06' })
  expect(resolveFeedDateRange({ ...base, period: 'week', periodAnchor: '2026-01-01' })).toEqual({ dateFrom: '2025-12-29', dateTo: '2026-01-04' })
})

test('a month covers its first to its last day, including February in a leap year', () => {
  expect(resolveFeedDateRange({ ...base, period: 'month', periodAnchor: '2026-10-31' })).toEqual({ dateFrom: '2026-10-01', dateTo: '2026-10-31' })
  expect(resolveFeedDateRange({ ...base, period: 'month', periodAnchor: '2026-02-10' })).toEqual({ dateFrom: '2026-02-01', dateTo: '2026-02-28' })
  expect(resolveFeedDateRange({ ...base, period: 'month', periodAnchor: '2024-02-10' })).toEqual({ dateFrom: '2024-02-01', dateTo: '2024-02-29' })
})

test('a year is the whole calendar year, all-time has no bounds, and a custom range passes through as typed', () => {
  expect(resolveFeedDateRange({ ...base, period: 'year', periodAnchor: '2026-08-21' })).toEqual({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })
  expect(resolveFeedDateRange({ ...base, period: 'all' })).toEqual({})
  expect(resolveFeedDateRange({ ...base, period: 'custom', customDateFrom: '2026-03-01', customDateTo: '' })).toEqual({ dateFrom: '2026-03-01', dateTo: undefined })
})
