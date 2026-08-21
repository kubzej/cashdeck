import { describe, expect, test } from 'vitest'
import { calculateTransferImpactCzk } from './domain.js'

describe('calculateTransferImpactCzk', () => {
  const transfer = { amountCzk: 1250, sourceWalletId: 'source', destinationWalletId: 'destination' }

  test('is neutral without a wallet filter or when both transfer wallets are selected', () => {
    expect(calculateTransferImpactCzk({ ...transfer, selectedWalletIds: null })).toBe(0)
    expect(calculateTransferImpactCzk({ ...transfer, selectedWalletIds: ['source', 'destination'] })).toBe(0)
  })

  test('is an expense for the selected source wallet and income for the selected destination wallet', () => {
    expect(calculateTransferImpactCzk({ ...transfer, selectedWalletIds: ['source'] })).toBe(-1250)
    expect(calculateTransferImpactCzk({ ...transfer, selectedWalletIds: ['destination'] })).toBe(1250)
  })
})
