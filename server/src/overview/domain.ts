import { feedPeriods, overviewGranularities, overviewSelectionTypes, type FeedPeriod, type OverviewGranularity, type OverviewSelectionType } from '../catalog.js'
import { asRecord, assertOnlyKeys, DomainError, parseCalendarDate, parseUuid } from '../management/domain.js'
import { parseSearch, parseWalletIds } from '../parsing.js'

export type { OverviewGranularity, OverviewSelectionType }

export type OverviewInput = {
  walletIds: string[] | null
  dateFrom: string | null
  dateTo: string | null
  period: FeedPeriod
  search: string | null
}

export type OverviewSelectionInput = {
  type: OverviewSelectionType
  id: string | null
  walletIds: string[] | null
  dateFrom: string
  dateTo: string
  granularity: OverviewGranularity
  search: string | null
}

export function parseOverviewSelectionQuery(value: unknown): OverviewSelectionInput {
  const query = asRecord(value)
  assertOnlyKeys(query, ['type', 'id', 'walletIds', 'dateFrom', 'dateTo', 'granularity', 'search'])

  const type = parseSelectionType(query.type)
  const id = type === 'total' ? null : parseUuid(query.id, type === 'category' ? 'Kategorie' : 'Štítek')
  const dateFrom = parseCalendarDate(query.dateFrom, 'Datum od')
  const dateTo = parseCalendarDate(query.dateTo, 'Datum do')
  if (dateFrom > dateTo) throw new DomainError(400, 'Datum od nesmí být po datu do.')
  const granularity = parseGranularity(query.granularity)
  assertOverviewBucketLimit(dateFrom, dateTo, granularity)
  const walletIds = query.walletIds === undefined ? null : parseWalletIds(query.walletIds)
  const search = query.search === undefined ? null : parseSearch(query.search)

  return { type, id, walletIds, dateFrom, dateTo, granularity, search }
}

function parseSelectionType(value: unknown): OverviewSelectionType {
  if (typeof value === 'string' && (overviewSelectionTypes as readonly string[]).includes(value)) return value as OverviewSelectionType
  throw new DomainError(400, 'Typ výběru není platný.')
}

function parseGranularity(value: unknown): OverviewGranularity {
  if (typeof value === 'string' && (overviewGranularities as readonly string[]).includes(value)) return value as OverviewGranularity
  throw new DomainError(400, 'Granularita přehledu není platná.')
}

export function parseOverviewQuery(value: unknown): OverviewInput {
  const query = asRecord(value)
  assertOnlyKeys(query, ['walletIds', 'dateFrom', 'dateTo', 'period', 'search'])

  const period = parsePeriod(query.period)
  const dateFrom = query.dateFrom === undefined ? null : parseCalendarDate(query.dateFrom, 'Datum od')
  const dateTo = query.dateTo === undefined ? null : parseCalendarDate(query.dateTo, 'Datum do')
  if (dateFrom && dateTo && dateFrom > dateTo) throw new DomainError(400, 'Datum od nesmí být po datu do.')
  if (period === 'all' && (dateFrom || dateTo)) throw new DomainError(400, 'Celá historie nemá vlastní datumové omezení.')
  if (period !== 'all' && (!dateFrom || !dateTo)) throw new DomainError(400, 'Pro přehled je potřeba zvolit celé období.')

  return {
    walletIds: query.walletIds === undefined ? null : parseWalletIds(query.walletIds),
    dateFrom,
    dateTo,
    period,
    search: query.search === undefined ? null : parseSearch(query.search),
  }
}

// The chart series is one generated bucket per day/month/quarter; anything beyond this is a
// malformed range, not a chart anyone can read.
const MAX_OVERVIEW_BUCKETS = 1000
const APPROXIMATE_DAYS_PER_BUCKET: Record<OverviewGranularity, number> = { day: 1, month: 30, quarter: 91 }

// The period is only a preference: a week/month/year period with a range far longer than
// that period falls back to the length-based rule instead of generating day buckets for it.
export function resolveOverviewGranularity(period: FeedPeriod, dateFrom: string, dateTo: string): OverviewGranularity {
  const days = daysBetween(dateFrom, dateTo)
  if ((period === 'week' || period === 'month') && days <= 93) return 'day'
  if (period === 'year' && days <= 366) return 'month'
  if (period === 'all') return days <= 730 ? 'month' : 'quarter'
  return days <= 93 ? 'day' : days <= 730 ? 'month' : 'quarter'
}

export function assertOverviewBucketLimit(dateFrom: string, dateTo: string, granularity: OverviewGranularity) {
  if (daysBetween(dateFrom, dateTo) / APPROXIMATE_DAYS_PER_BUCKET[granularity] > MAX_OVERVIEW_BUCKETS) {
    throw new DomainError(400, 'Zvolené období je pro přehled příliš dlouhé.')
  }
}

function daysBetween(dateFrom: string, dateTo: string) {
  return Math.max(0, Math.round((Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000))
}

function parsePeriod(value: unknown): FeedPeriod {
  if (typeof value === 'string' && (feedPeriods as readonly string[]).includes(value)) return value as FeedPeriod
  throw new DomainError(400, 'Období přehledu není platné.')
}
