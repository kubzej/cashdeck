import { resolveFeedDateRange, type FeedFilterValue } from '../feed/feed-filters'
import { formatIsoDate, getPragueToday, parseIsoDate } from '../../lib/prague-date'

export type PlannedRange = { dateFrom: string; dateTo: string }

export function resolvePlannedRange(filters: FeedFilterValue, today = getPragueToday()): PlannedRange | null {
  const tomorrow = addDays(today, 1)
  if (filters.period === 'all') return null

  const range = resolveFeedDateRange(filters)
  if (!range.dateTo) return null
  const dateFrom = range.dateFrom && range.dateFrom > tomorrow ? range.dateFrom : tomorrow
  if (dateFrom > range.dateTo) return null
  return { dateFrom, dateTo: range.dateTo }
}

function addDays(value: string, amount: number) {
  const date = parseIsoDate(value)
  date.setDate(date.getDate() + amount)
  return formatIsoDate(date)
}
