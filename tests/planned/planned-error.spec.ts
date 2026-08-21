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

test('shows the error state and recovers after retrying a failed Naplanovane load', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  await mockCategoriesApi(page, [category])
  await mockLabelsApi(page, [])
  await mockTransactionsApi(page)
  await mockFeedApi(page, [])
  const plannedApi = await mockPlannedApi(page, [
    { kind: 'transaction', id: 'planned-manual-1', origin: 'manual', recurringRuleId: null, recurringRuleName: null, walletId: wallet.id, walletName: wallet.name, categoryId: category.id, categoryName: category.name, categoryIconKey: category.iconKey, categoryColorKey: category.colorKey, direction: 'expense', amountCzk: 500, transactionDate: '2026-08-24', note: null, labels: [] },
  ])

  await page.goto('/')
  await signIn(page)

  const summary = page.getByRole('button', { name: /Naplánované/ })
  await expect(summary).toContainText('1 položka')

  plannedApi.failNext({ message: 'Dočasně nedostupné.' })
  await summary.click()

  await expect(page.getByText('Naplánované se nepodařilo načíst', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zkusit znovu' }).click()

  await expect(page.getByRole('button', { name: /Domov/ })).toBeVisible()
})
