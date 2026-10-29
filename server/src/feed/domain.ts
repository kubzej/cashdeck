import { asRecord, assertOnlyKeys, DomainError, parseCalendarDate, parseUuid } from '../management/domain.js'
import { parseLimit, parseSearch, parseWalletIds } from '../parsing.js'

export type FeedListInput = {
  walletIds: string[] | null
  dateFrom: string | null
  dateTo: string | null
  search: string | null
  categoryId?: string
  labelId?: string
  cursor: string | null
  limit: number
}

export type FeedBoundsInput = Pick<FeedListInput, 'walletIds' | 'categoryId' | 'labelId'>

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
  assertOnlyKeys(query, ['walletIds', 'dateFrom', 'dateTo', 'search', 'categoryId', 'labelId', 'cursor', 'limit'])
  const dateFrom = query.dateFrom === undefined ? null : parseCalendarDate(query.dateFrom, 'Datum od')
  const dateTo = query.dateTo === undefined ? null : parseCalendarDate(query.dateTo, 'Datum do')
  if (dateFrom && dateTo && dateFrom > dateTo) throw new DomainError(400, 'Datum od nesmí být po datu do.')

  return {
    walletIds: query.walletIds === undefined ? null : parseWalletIds(query.walletIds),
    dateFrom,
    dateTo,
    search: query.search === undefined ? null : parseSearch(query.search),
    ...(query.categoryId === undefined ? {} : { categoryId: parseUuid(query.categoryId, 'Kategorie') }),
    ...(query.labelId === undefined ? {} : { labelId: parseUuid(query.labelId, 'Štítek') }),
    cursor: query.cursor === undefined ? null : parseCursor(query.cursor),
    limit: query.limit === undefined ? 50 : parseLimit(query.limit),
  }
}

export function parseFeedBoundsQuery(value: unknown): FeedBoundsInput {
  const query = asRecord(value)
  assertOnlyKeys(query, ['walletIds', 'categoryId', 'labelId'])
  return {
    walletIds: query.walletIds === undefined ? null : parseWalletIds(query.walletIds),
    ...(query.categoryId === undefined ? {} : { categoryId: parseUuid(query.categoryId, 'Kategorie') }),
    ...(query.labelId === undefined ? {} : { labelId: parseUuid(query.labelId, 'Štítek') }),
  }
}

function parseCursor(value: unknown) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 300) throw new DomainError(400, 'Kurzór přehledu není platný.')
  return value
}
