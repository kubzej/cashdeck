import {
  asRecord,
  assertOnlyKeys,
  DomainError,
  parseCalendarDate,
  parseUuid,
  parseWholeCzk,
} from '../management/domain.js'

export type TransferInput = {
  sourceWalletId: string
  destinationWalletId: string
  amountCzk: number
  transferDate: string
  note: string | null
  labelIds: string[]
}

export type TransferUpdateInput = Partial<TransferInput>

export type TransferListInput = {
  walletId: string | null
  dateFrom: string | null
  dateTo: string | null
  cursor: string | null
  limit: number
}

export function parseCreateTransfer(body: unknown): TransferInput {
  const value = asRecord(body)
  assertOnlyKeys(value, ['sourceWalletId', 'destinationWalletId', 'amountCzk', 'transferDate', 'note', 'labelIds'])
  const sourceWalletId = parseUuid(value.sourceWalletId, 'Zdrojová peněženka')
  const destinationWalletId = parseUuid(value.destinationWalletId, 'Cílová peněženka')
  assertDifferentWallets(sourceWalletId, destinationWalletId)
  return {
    sourceWalletId,
    destinationWalletId,
    amountCzk: parsePositiveAmount(value.amountCzk),
    transferDate: parseCalendarDate(value.transferDate, 'Datum převodu'),
    note: parseOptionalNote(value.note),
    labelIds: value.labelIds === undefined ? [] : parseLabelIds(value.labelIds),
  }
}

export function parseUpdateTransfer(body: unknown): TransferUpdateInput {
  const value = asRecord(body)
  assertOnlyKeys(value, ['sourceWalletId', 'destinationWalletId', 'amountCzk', 'transferDate', 'note', 'labelIds'])
  const update: TransferUpdateInput = {}

  if ('sourceWalletId' in value) update.sourceWalletId = parseUuid(value.sourceWalletId, 'Zdrojová peněženka')
  if ('destinationWalletId' in value) update.destinationWalletId = parseUuid(value.destinationWalletId, 'Cílová peněženka')
  if (update.sourceWalletId && update.destinationWalletId) assertDifferentWallets(update.sourceWalletId, update.destinationWalletId)
  if ('amountCzk' in value) update.amountCzk = parsePositiveAmount(value.amountCzk)
  if ('transferDate' in value) update.transferDate = parseCalendarDate(value.transferDate, 'Datum převodu')
  if ('note' in value) update.note = parseOptionalNote(value.note)
  if ('labelIds' in value) update.labelIds = parseLabelIds(value.labelIds)

  if (Object.keys(update).length === 0) throw new DomainError(400, 'Chybí změna převodu.')
  return update
}

export function parseTransferListQuery(value: unknown): TransferListInput {
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

export function assertDifferentWallets(sourceWalletId: string, destinationWalletId: string) {
  if (sourceWalletId === destinationWalletId) throw new DomainError(400, 'Zdrojová a cílová peněženka musí být rozdílné.')
}

function parsePositiveAmount(value: unknown) {
  const amount = parseWholeCzk(value, 'Částka', { allowNegative: false })
  if (amount <= 0) throw new DomainError(400, 'Částka musí být alespoň 1 Kč.')
  return amount
}

function parseOptionalNote(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new DomainError(400, 'Poznámka musí být text.')
  const note = value.trim()
  if (!note) return null
  if (note.length > 2000) throw new DomainError(400, 'Poznámka může mít nejvýše 2 000 znaků.')
  return note
}

function parseLabelIds(value: unknown) {
  if (!Array.isArray(value)) throw new DomainError(400, 'Štítky musí být seznam ID.')
  const labelIds = value.map((labelId) => parseUuid(labelId, 'Štítek'))
  if (labelIds.length !== new Set(labelIds).size) throw new DomainError(400, 'Štítky se nesmí opakovat.')
  return labelIds
}

function parseCursor(value: unknown) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 300) throw new DomainError(400, 'Kurzór převodů není platný.')
  return value
}

function parseLimit(value: unknown) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new DomainError(400, 'Parametr limit není platný.')
  const limit = Number(value)
  if (limit < 1 || limit > 100) throw new DomainError(400, 'Parametr limit musí být mezi 1 a 100.')
  return limit
}
