import { asRecord, assertOnlyKeys, DomainError, parseCalendarDate, parseUuid } from '../management/domain.js'

export type FeedListInput = {
  walletId: string | null
  dateFrom: string | null
  dateTo: string | null
  cursor: string | null
  limit: number
}

export function parseFeedListQuery(value: unknown): FeedListInput {
  const query = asRecord(value)
  assertOnlyKeys(query, ['walletId', 'dateFrom', 'dateTo', 'cursor', 'limit'])
  const dateFrom = query.dateFrom === undefined ? null : parseCalendarDate(query.dateFrom, 'Datum od')
  const dateTo = query.dateTo === undefined ? null : parseCalendarDate(query.dateTo, 'Datum do')
  if (dateFrom && dateTo && dateFrom > dateTo) throw new DomainError(400, 'Datum od nesmí být po datu do.')

  return {
    walletId: query.walletId === undefined ? null : parseUuid(query.walletId, 'Peněženka'),
    dateFrom,
    dateTo,
    cursor: query.cursor === undefined ? null : parseCursor(query.cursor),
    limit: query.limit === undefined ? 50 : parseLimit(query.limit),
  }
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
