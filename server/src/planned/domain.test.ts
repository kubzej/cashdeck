import { expect, test } from 'vitest'
import { getPlannedRange, projectRecurringRules, summarizePlanned, type RecurringProjectionRule } from './domain.js'

const rule: RecurringProjectionRule = {
  id: 'rule-1', name: 'Nájem', kind: 'transaction', amountCzk: 23_000,
  walletId: 'wallet-1', walletName: 'Běžný účet', categoryId: 'category-1', categoryName: 'Bydlení',
  categoryIconKey: 'house', categoryColorKey: 'orange', categoryDirection: 'expense',
  sourceWalletId: null, sourceWalletName: null, destinationWalletId: null, destinationWalletName: null,
  note: 'Nájemné', labels: [{ id: 'label-1', name: 'byt' }], frequency: 'monthly', customIntervalDays: null,
  scheduleAnchorDate: '2026-01-31', nextOccurrenceDate: '2026-08-31', endsOn: null,
}

test('keeps planned data strictly in the future', () => {
  expect(getPlannedRange({ walletIds: null, dateFrom: '2026-08-01', dateTo: '2026-08-31' }, '2026-08-20')).toEqual({ dateFrom: '2026-08-21', dateTo: '2026-08-31' })
  expect(getPlannedRange({ walletIds: null, dateFrom: '2026-08-01', dateTo: '2026-08-20' }, '2026-08-20')).toEqual({ dateFrom: '2026-08-21', dateTo: '2026-08-20' })
})

test('projects anchored monthly occurrences only within the selected future range', () => {
  const items = projectRecurringRules([rule], { walletIds: null, dateFrom: '2026-08-01', dateTo: '2026-11-30' }, '2026-08-20')
  expect(items.map((item) => item.kind === 'transaction' ? item.transactionDate : item.transferDate)).toEqual(['2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30'])
  expect(items.every((item) => item.origin === 'recurring')).toBe(true)
})

test('does not project occurrences after the configured end date', () => {
  const items = projectRecurringRules([{ ...rule, endsOn: '2026-09-30' }], { walletIds: null, dateFrom: '2026-08-01', dateTo: '2026-12-31' }, '2026-08-20')
  expect(items).toHaveLength(2)
})

test('uses the selected wallet impact for recurring transfers and summarizes entries', () => {
  const transferRule: RecurringProjectionRule = {
    ...rule,
    id: 'rule-2', name: 'Spoření', kind: 'transfer', walletId: null, walletName: null,
    categoryId: null, categoryName: null, categoryIconKey: null, categoryColorKey: null, categoryDirection: null,
    sourceWalletId: 'wallet-1', sourceWalletName: 'Běžný účet', destinationWalletId: 'wallet-2', destinationWalletName: 'Spoření',
    amountCzk: 5_000, nextOccurrenceDate: '2026-08-25', scheduleAnchorDate: '2026-08-25', frequency: 'monthly', note: null, labels: [],
  }
  const allWallets = projectRecurringRules([transferRule], { walletIds: null, dateFrom: '2026-08-01', dateTo: '2026-08-31' }, '2026-08-20')
  const oneWallet = projectRecurringRules([transferRule], { walletIds: ['wallet-1'], dateFrom: '2026-08-01', dateTo: '2026-08-31' }, '2026-08-20')

  expect(allWallets[0]).toMatchObject({ kind: 'transfer', impactCzk: 0 })
  expect(oneWallet[0]).toMatchObject({ kind: 'transfer', impactCzk: -5_000 })
  expect(summarizePlanned([...oneWallet, ...projectRecurringRules([rule], { walletIds: null, dateFrom: '2026-08-01', dateTo: '2026-08-31' }, '2026-08-20')])).toEqual({ count: 2, totalCzk: -28_000 })
})
