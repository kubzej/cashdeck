import {
  asRecord,
  assertOnlyKeys,
  DomainError,
  parseCalendarDate,
  parseUuid,
  parseWholeCzk,
} from '../management/domain.js'

export type TransactionInput = {
  walletId: string
  categoryId: string
  amountCzk: number
  transactionDate: string
  note: string | null
  labelIds: string[]
}

export type TransactionUpdateInput = Partial<TransactionInput>

export function parseCreateTransaction(body: unknown): TransactionInput {
  const value = asRecord(body)
  assertOnlyKeys(value, ['walletId', 'categoryId', 'amountCzk', 'transactionDate', 'note', 'labelIds'])
  return {
    walletId: parseUuid(value.walletId, 'Peněženka'),
    categoryId: parseUuid(value.categoryId, 'Kategorie'),
    amountCzk: parsePositiveAmount(value.amountCzk),
    transactionDate: parseCalendarDate(value.transactionDate, 'Datum transakce'),
    note: parseOptionalNote(value.note),
    labelIds: value.labelIds === undefined ? [] : parseLabelIds(value.labelIds),
  }
}

export function parseUpdateTransaction(body: unknown): TransactionUpdateInput {
  const value = asRecord(body)
  assertOnlyKeys(value, ['walletId', 'categoryId', 'amountCzk', 'transactionDate', 'note', 'labelIds'])
  const update: TransactionUpdateInput = {}

  if ('walletId' in value) update.walletId = parseUuid(value.walletId, 'Peněženka')
  if ('categoryId' in value) update.categoryId = parseUuid(value.categoryId, 'Kategorie')
  if ('amountCzk' in value) update.amountCzk = parsePositiveAmount(value.amountCzk)
  if ('transactionDate' in value) update.transactionDate = parseCalendarDate(value.transactionDate, 'Datum transakce')
  if ('note' in value) update.note = parseOptionalNote(value.note)
  if ('labelIds' in value) update.labelIds = parseLabelIds(value.labelIds)

  if (Object.keys(update).length === 0) throw new DomainError(400, 'Chybí změna transakce.')
  return update
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
