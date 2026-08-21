import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockCategoriesApi } from '../support/categories'
import { mockFeedApi } from '../support/feed'
import { mockLabelsApi } from '../support/labels'
import { mockPlannedApi } from '../support/planned'
import { mockTransactionsApi } from '../support/transactions'
import { mockWalletsApi } from '../support/wallets'

const wallet = { id: 'wallet-1', name: 'Moneta', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false }
const category = { id: 'category-1', name: 'Domov', direction: 'expense' as const, iconKey: 'house', colorKey: 'orange', sortOrder: 0 }

test('keeps future manual and recurring items in Naplanovane, with only manual items editable', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  await mockCategoriesApi(page, [category])
  await mockLabelsApi(page, [{ id: 'label-1', name: 'najem' }])
  await mockTransactionsApi(page)
  await mockFeedApi(page, [{ kind: 'transaction', id: 'today-1', walletId: wallet.id, walletName: wallet.name, categoryId: category.id, categoryName: category.name, categoryIconKey: category.iconKey, categoryColorKey: category.colorKey, direction: 'expense', amountCzk: 250, transactionDate: '2026-08-21', note: null, labels: [] }])
  const plannedApi = await mockPlannedApi(page, [
    { kind: 'transaction', id: 'planned-manual-1', origin: 'manual', recurringRuleId: null, recurringRuleName: null, walletId: wallet.id, walletName: wallet.name, categoryId: category.id, categoryName: category.name, categoryIconKey: category.iconKey, categoryColorKey: category.colorKey, direction: 'expense', amountCzk: 500, transactionDate: '2026-08-24', note: 'Platba předem', labels: [{ id: 'label-1', name: 'najem' }] },
    { kind: 'transaction', id: 'rule-1:2026-08-28', origin: 'recurring', recurringRuleId: 'rule-1', recurringRuleName: 'Automatická výplata', walletId: wallet.id, walletName: wallet.name, categoryId: category.id, categoryName: 'Výplata', categoryIconKey: 'banknote-arrow-up', categoryColorKey: 'green', direction: 'income', amountCzk: 12000, transactionDate: '2026-08-28', note: null, labels: [] },
  ])

  await page.goto('/')
  await signIn(page)

  await expect(page.getByText('Platba předem', { exact: true })).toHaveCount(0)
  const summary = page.getByRole('button', { name: /Naplánované/ })
  await expect(summary).toContainText('2 položky')
  await expect(summary).toContainText('+11\u00a0500 Kč')
  await summary.click()

  await expect(page.getByRole('heading', { name: 'Naplánované', exact: true })).toBeVisible()
  const manualItem = page.getByRole('button', { name: /Domov/ })
  await expect(manualItem).toContainText('Platba předem')
  await expect(manualItem).toContainText('najem')

  const recurringItem = page.locator('.planned-row--recurring').filter({ hasText: 'Automatická výplata' })
  await expect(recurringItem).toContainText('Opakování')
  await expect(recurringItem).not.toHaveAttribute('data-interactive', 'true')
  await expect(page.getByRole('button', { name: /Automatická výplata/ })).toHaveCount(0)

  await manualItem.click()
  await expect(page.getByRole('heading', { name: 'Upravit transakci', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zpět na transakce' }).click()
  await expect(page.getByRole('heading', { name: 'Naplánované', exact: true })).toBeVisible()
  await expect.poll(() => plannedApi.requests().length).toBeGreaterThanOrEqual(2)
  const initialRequest = plannedApi.requests()[0]
  const returnedRequest = plannedApi.requests().at(-1)
  if (!returnedRequest) throw new Error('Naplánované se po návratu z editoru znovu nenačetlo.')
  expect(returnedRequest.search).toBe(initialRequest.search)
})

test('shows future transfers in Naplanovane, greyed and non-interactive only when recurring', async ({ page }) => {
  const destination = { id: 'wallet-2', name: 'Spořicí účet', colorKey: 'blue', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 1, isHidden: false, openingBalanceLocked: false }
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet, destination])
  await mockCategoriesApi(page, [category])
  await mockLabelsApi(page, [])
  await mockTransactionsApi(page)
  await mockFeedApi(page, [])
  await mockPlannedApi(page, [
    { kind: 'transfer', id: 'planned-transfer-manual-1', origin: 'manual', recurringRuleId: null, recurringRuleName: null, sourceWalletId: wallet.id, sourceWalletName: wallet.name, destinationWalletId: destination.id, destinationWalletName: destination.name, amountCzk: 2000, impactCzk: 0, transferDate: '2026-08-24', note: null, labels: [] },
    { kind: 'transfer', id: 'rule-2:2026-08-30', origin: 'recurring', recurringRuleId: 'rule-2', recurringRuleName: null, sourceWalletId: wallet.id, sourceWalletName: wallet.name, destinationWalletId: destination.id, destinationWalletName: destination.name, amountCzk: 5000, impactCzk: 0, transferDate: '2026-08-30', note: null, labels: [] },
  ])

  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: /Naplánované/ }).click()
  await expect(page.getByRole('heading', { name: 'Naplánované', exact: true })).toBeVisible()

  const manualTransfer = page.getByRole('button', { name: /Moneta do Spořicí účet/ })
  await expect(manualTransfer).toContainText('Převod')

  const recurringTransfer = page.locator('.planned-row--recurring').filter({ hasText: 'Moneta do Spořicí účet' })
  await expect(recurringTransfer).toContainText('Opakování')
  await expect(recurringTransfer).not.toHaveAttribute('data-interactive', 'true')
  await expect(page.getByRole('button', { name: /5\s?000 Kč/ })).toHaveCount(0)
})
