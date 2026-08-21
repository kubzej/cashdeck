import { expect, test } from 'vitest'
import { resolvePlannedRange } from './planned-range'
import type { FeedFilterValue } from '../feed/feed-filters'

const baseFilters: FeedFilterValue = {
  walletIds: [], period: 'month', periodAnchor: '2026-08-20', customDateFrom: '2026-08-01', customDateTo: '2026-08-31', search: '',
}

test('uses only the remaining future part of the selected period', () => {
  expect(resolvePlannedRange(baseFilters, '2026-08-20')).toEqual({ dateFrom: '2026-08-21', dateTo: '2026-08-31' })
})

test('does not show planned data for a historical period', () => {
  expect(resolvePlannedRange({ ...baseFilters, periodAnchor: '2026-07-20' }, '2026-08-20')).toBeNull()
})

test('does not create a planned horizon for all history', () => {
  expect(resolvePlannedRange({ ...baseFilters, period: 'all' }, '2026-08-20')).toBeNull()
})

test('keeps the complete selected range when it lies in the future', () => {
  expect(resolvePlannedRange({ ...baseFilters, periodAnchor: '2026-09-20' }, '2026-08-20')).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
})
