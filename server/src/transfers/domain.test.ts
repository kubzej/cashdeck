import { expect, test } from 'vitest'
import { DomainError } from '../management/domain.js'
import { parseCreateTransfer, parseTransferListQuery, parseUpdateTransfer } from './domain.js'

const sourceWalletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'
const destinationWalletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef124'
const labelId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef125'

test('parses and normalizes a transfer input', () => {
  expect(parseCreateTransfer({ sourceWalletId, destinationWalletId, amountCzk: 2500, transferDate: '2026-08-20', note: '  Rezerva  ', labelIds: [labelId] })).toEqual({
    sourceWalletId,
    destinationWalletId,
    amountCzk: 2500,
    transferDate: '2026-08-20',
    note: 'Rezerva',
    labelIds: [labelId],
  })
})

test('rejects transfers between the same wallet and invalid amounts', () => {
  expect(() => parseCreateTransfer({ sourceWalletId, destinationWalletId: sourceWalletId, amountCzk: 1, transferDate: '2026-08-20' })).toThrow(new DomainError(400, 'Zdrojová a cílová peněženka musí být rozdílné.'))
  expect(() => parseCreateTransfer({ sourceWalletId, destinationWalletId, amountCzk: 0, transferDate: '2026-08-20' })).toThrow(new DomainError(400, 'Částka musí být alespoň 1 Kč.'))
})

test('parses partial updates and wallet-scoped listing', () => {
  expect(parseUpdateTransfer({ note: '  Přesun  ', labelIds: [] })).toEqual({ note: 'Přesun', labelIds: [] })
  expect(parseTransferListQuery({ walletId: sourceWalletId, dateFrom: '2026-08-01', dateTo: '2026-08-31', limit: '25' })).toEqual({
    walletId: sourceWalletId,
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    cursor: null,
    limit: 25,
  })
})
