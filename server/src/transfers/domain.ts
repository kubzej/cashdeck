import {
  asRecord,
  assertOnlyKeys,
  DomainError,
  parseCalendarDate,
  parseUuid,
} from '../management/domain.js'
import { parseLabelIds, parseOptionalNote, parsePositiveAmount } from '../parsing.js'

export type TransferInput = {
  sourceWalletId: string
  destinationWalletId: string
  amountCzk: number
  transferDate: string
  note: string | null
  labelIds: string[]
}

export type TransferUpdateInput = Partial<TransferInput>

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

export function assertDifferentWallets(sourceWalletId: string, destinationWalletId: string) {
  if (sourceWalletId === destinationWalletId) throw new DomainError(400, 'Zdrojová a cílová peněženka musí být rozdílné.')
}
