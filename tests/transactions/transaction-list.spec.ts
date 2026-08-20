import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockTransactionsApi } from '../support/transactions'
import { mockTransfersApi } from '../support/transfers'

test('loads the next page of transactions on demand', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockTransactionsApi(page, Array.from({ length: 51 }, (_, index) => ({
    id: `transaction-${index + 1}`,
    walletId: 'wallet-1',
    walletName: 'Běžný účet',
    categoryId: `category-${index + 1}`,
    categoryName: `Kategorie ${index + 1}`,
    categoryIconKey: 'tags' as const,
    categoryColorKey: 'teal' as const,
    direction: 'expense' as const,
    amountCzk: index + 1,
    transactionDate: '2026-08-20',
    note: null,
    labels: [],
  })))
  await mockTransfersApi(page)
  await page.goto('/')
  await signIn(page)

  await expect(page.getByRole('button', { name: 'Načíst další' })).toBeVisible()
  await page.getByRole('button', { name: 'Načíst další' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Kategorie 51' })).toBeVisible()
})
