import { asRecord, assertOnlyKeys, DomainError, parseCalendarDate, parseUuid } from '../management/domain.js'

export type FeedListInput = {
  walletIds: string[] | null
  dateFrom: string | null
  dateTo: string | null
  search: string | null
  cursor: string | null
  limit: number
}

export function calculateTransferImpactCzk({ amountCzk, sourceWalletId, destinationWalletId, selectedWalletIds }: { amountCzk: number; sourceWalletId: string; destinationWalletId: string; selectedWalletIds: string[] | null }) {
  if (!selectedWalletIds) return 0
  const selected = new Set(selectedWalletIds)
  const sourceIsSelected = selected.has(sourceWalletId)
  const destinationIsSelected = selected.has(destinationWalletId)
  if (sourceIsSelected && !destinationIsSelected) return -amountCzk
  if (destinationIsSelected && !sourceIsSelected) return amountCzk
  return 0
}

export function parseFeedListQuery(value: unknown): FeedListInput {
  const query = asRecord(value)
  assertOnlyKeys(query, ['walletIds', 'dateFrom', 'dateTo', 'search', 'cursor', 'limit'])
  const dateFrom = query.dateFrom === undefined ? null : parseCalendarDate(query.dateFrom, 'Datum od')
  const dateTo = query.dateTo === undefined ? null : parseCalendarDate(query.dateTo, 'Datum do')
  if (dateFrom && dateTo && dateFrom > dateTo) throw new DomainError(400, 'Datum od nesmí být po datu do.')

  return {
    walletIds: query.walletIds === undefined ? null : parseWalletIds(query.walletIds),
    dateFrom,
    dateTo,
    search: query.search === undefined ? null : parseSearch(query.search),
    cursor: query.cursor === undefined ? null : parseCursor(query.cursor),
    limit: query.limit === undefined ? 50 : parseLimit(query.limit),
  }
}

function parseWalletIds(value: unknown) {
  if (typeof value !== 'string' || !value) throw new DomainError(400, 'Výběr peněženek není platný.')
  const walletIds = value.split(',')
  if (walletIds.length > 50 || walletIds.some((walletId) => !walletId)) throw new DomainError(400, 'Výběr peněženek není platný.')
  const parsed = walletIds.map((walletId) => parseUuid(walletId, 'Peněženka'))
  if (new Set(parsed).size !== parsed.length) throw new DomainError(400, 'Výběr peněženek obsahuje duplicitu.')
  return parsed
}

function parseSearch(value: unknown) {
  if (typeof value !== 'string') throw new DomainError(400, 'Hledání není platné.')
  const search = value.trim()
  if (!search) return null
  if (search.length > 100) throw new DomainError(400, 'Hledání může mít nejvýše 100 znaků.')
  return search
}

function parseCursor(value: unknown) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 300) throw new DomainError(400, 'Kurzór přehledu není platný.')
  return value
}

function parseLimit(value: unknown) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new DomainError(400, 'Parametr limit není platný.')
  const limit = Number(value)
  if (limit < 1 || limit > 100) throw new DomainError(400, 'Parametr limit musí být mezi 1 a 100.')
  return limit
}
