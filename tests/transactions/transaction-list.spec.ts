import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockFeedApi } from '../support/feed'

test('loads the next page of transactions on demand', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockFeedApi(page, Array.from({ length: 51 }, (_, index) => ({
    kind: 'transaction' as const,
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
  await page.goto('/')
  await signIn(page)

  await expect(page.getByRole('button', { name: 'Načíst další' })).toBeVisible()
  await page.getByRole('button', { name: 'Načíst další' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Kategorie 51' })).toBeVisible()
})

test('shows the originating recurring rule\'s name as a second line below the category/wallet title, for a generated transaction or transfer', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockFeedApi(page, [
    {
      kind: 'transaction' as const,
      id: 'transaction-1',
      walletId: 'wallet-1',
      walletName: 'Moneta',
      categoryId: 'category-1',
      categoryName: 'Předplatné',
      categoryIconKey: 'tags' as const,
      categoryColorKey: 'orange' as const,
      direction: 'expense' as const,
      amountCzk: 698,
      transactionDate: '2026-08-22',
      note: null,
      labels: [],
      recurringRuleName: 'Oneplay',
    },
    {
      kind: 'transfer' as const,
      id: 'transfer-1',
      sourceWalletId: 'wallet-1',
      sourceWalletName: 'Moneta',
      destinationWalletId: 'wallet-2',
      destinationWalletName: 'Česká Spořitelna',
      amountCzk: 17057,
      impactCzk: -17057,
      transferDate: '2026-08-20',
      note: null,
      labels: [],
      recurringRuleName: 'Hypotéka',
    },
  ])
  await page.goto('/')
  await signIn(page)

  const transactionRow = page.getByRole('listitem').filter({ hasText: 'Oneplay' })
  await expect(transactionRow).toContainText('Předplatné')
  await expect(transactionRow).toContainText('v Moneta')
  await expect(transactionRow).toContainText('Oneplay')
  await expect(transactionRow.locator('[data-slot="list-item-title"]')).not.toContainText('Oneplay')

  const transferRow = page.getByRole('listitem').filter({ hasText: 'Hypotéka' })
  await expect(transferRow).toContainText('Převod')
  await expect(transferRow).toContainText('z Moneta do Česká Spořitelna')
  await expect(transferRow).toContainText('Hypotéka')
})

test('shows the error state and recovers after retrying a failed transaction load', async ({ page }) => {
  await mockAuthAndApi(page)
  const feedApi = await mockFeedApi(page, [{
    kind: 'transaction' as const,
    id: 'transaction-1',
    walletId: 'wallet-1',
    walletName: 'Běžný účet',
    categoryId: 'category-1',
    categoryName: 'Jídlo',
    categoryIconKey: 'utensils' as const,
    categoryColorKey: 'orange' as const,
    direction: 'expense' as const,
    amountCzk: 250,
    transactionDate: '2026-08-20',
    note: null,
    labels: [],
  }])
  feedApi.failNext({ message: 'Dočasně nedostupné.' })
  await page.goto('/')
  await signIn(page)

  const errorAlert = page.getByRole('alert').filter({ hasText: 'Transakce se nepodařilo načíst' })
  await expect(errorAlert).toBeVisible()
  await errorAlert.getByRole('button', { name: 'Zkusit znovu' }).click()

  await expect(page.getByRole('listitem').filter({ hasText: 'Jídlo' })).toBeVisible()
})
