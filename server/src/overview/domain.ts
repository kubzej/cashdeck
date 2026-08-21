import { asRecord, assertOnlyKeys, DomainError, parseCalendarDate, parseUuid } from '../management/domain.js'

export type OverviewPeriod = 'week' | 'month' | 'year' | 'all' | 'custom'

export type OverviewInput = {
  walletIds: string[] | null
  dateFrom: string | null
  dateTo: string | null
  period: OverviewPeriod
}

export type OverviewGranularity = 'day' | 'month' | 'quarter'

export type OverviewSelectionType = 'category' | 'label'

export type OverviewSelectionInput = {
  type: OverviewSelectionType
  id: string
  walletIds: string[] | null
  dateFrom: string
  dateTo: string
  granularity: OverviewGranularity
}

export function parseOverviewSelectionQuery(value: unknown): OverviewSelectionInput {
  const query = asRecord(value)
  assertOnlyKeys(query, ['type', 'id', 'walletIds', 'dateFrom', 'dateTo', 'granularity'])

  const type = parseSelectionType(query.type)
  const id = parseUuid(query.id, type === 'category' ? 'Kategorie' : 'Štítek')
  const dateFrom = parseCalendarDate(query.dateFrom, 'Datum od')
  const dateTo = parseCalendarDate(query.dateTo, 'Datum do')
  if (dateFrom > dateTo) throw new DomainError(400, 'Datum od nesmí být po datu do.')
  const granularity = parseGranularity(query.granularity)
  const walletIds = query.walletIds === undefined ? null : parseWalletIds(query.walletIds)

  return { type, id, walletIds, dateFrom, dateTo, granularity }
}

function parseSelectionType(value: unknown): OverviewSelectionType {
  if (value === 'category' || value === 'label') return value
  throw new DomainError(400, 'Typ výběru není platný.')
}

function parseGranularity(value: unknown): OverviewGranularity {
  if (value === 'day' || value === 'month' || value === 'quarter') return value
  throw new DomainError(400, 'Granularita přehledu není platná.')
}

export function parseOverviewQuery(value: unknown): OverviewInput {
  const query = asRecord(value)
  assertOnlyKeys(query, ['walletIds', 'dateFrom', 'dateTo', 'period'])

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
  }
}

export function resolveOverviewGranularity(period: OverviewPeriod, dateFrom: string, dateTo: string): OverviewGranularity {
  if (period === 'week' || period === 'month') return 'day'
  if (period === 'year') return 'month'

  const days = Math.max(0, Math.round((Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000))
  if (period === 'custom') return days <= 93 ? 'day' : days <= 730 ? 'month' : 'quarter'
  return days <= 730 ? 'month' : 'quarter'
}

function parsePeriod(value: unknown): OverviewPeriod {
  if (value === 'week' || value === 'month' || value === 'year' || value === 'all' || value === 'custom') return value
  throw new DomainError(400, 'Období přehledu není platné.')
}

function parseWalletIds(value: unknown) {
  if (typeof value !== 'string' || !value) throw new DomainError(400, 'Výběr peněženek není platný.')
  const walletIds = value.split(',')
  if (walletIds.length > 50 || walletIds.some((walletId) => !walletId)) throw new DomainError(400, 'Výběr peněženek není platný.')
  const parsed = walletIds.map((walletId) => parseUuid(walletId, 'Peněženka'))
  if (new Set(parsed).size !== parsed.length) throw new DomainError(400, 'Výběr peněženek obsahuje duplicitu.')
  return parsed
}
