import { expect, test } from 'vitest'
import { resolvePlannedRange } from './planned-range'
import type { FeedFilterValue } from '../feed/feed-filters'

const baseFilters: FeedFilterValue = {
  walletIds: [], period: 'month', periodAnchor: '2026-08-20', customDateFrom: '2026-08-01', customDateTo: '2026-08-31', search: '',
}

test('uses only the remaining future part of the selected period', () => {
  expect(resolvePlannedRange(baseFilters, '2026-08-20')).toEqual({ dateFrom: '2026-08-21', dateTo: '2026-08-31', isTwelveMonthHorizon: false })
})

test('does not show planned data for a historical period', () => {
  expect(resolvePlannedRange({ ...baseFilters, periodAnchor: '2026-07-20' }, '2026-08-20')).toBeNull()
})

test('uses a bounded twelve-month future horizon for all history', () => {
  expect(resolvePlannedRange({ ...baseFilters, period: 'all' }, '2026-08-20')).toEqual({ dateFrom: '2026-08-21', dateTo: '2027-08-21', isTwelveMonthHorizon: true })
})
