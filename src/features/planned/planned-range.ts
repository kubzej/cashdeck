import { getFeedToday, resolveFeedDateRange, type FeedFilterValue } from '../feed/feed-filters'

export type PlannedRange = { dateFrom: string; dateTo: string; isTwelveMonthHorizon: boolean }

export function resolvePlannedRange(filters: FeedFilterValue, today = getFeedToday()): PlannedRange | null {
  const tomorrow = addDays(today, 1)
  if (filters.period === 'all') return { dateFrom: tomorrow, dateTo: addCalendarMonths(tomorrow, 12), isTwelveMonthHorizon: true }

  const range = resolveFeedDateRange(filters)
  if (!range.dateTo) return null
  const dateFrom = range.dateFrom && range.dateFrom > tomorrow ? range.dateFrom : tomorrow
  if (dateFrom > range.dateTo) return null
  return { dateFrom, dateTo: range.dateTo, isTwelveMonthHorizon: false }
}

function addDays(value: string, amount: number) {
  const date = parseIsoDate(value)
  date.setDate(date.getDate() + amount)
  return formatIsoDate(date)
}

function addCalendarMonths(value: string, amount: number) {
  const date = parseIsoDate(value)
  date.setMonth(date.getMonth() + amount)
  return formatIsoDate(date)
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
