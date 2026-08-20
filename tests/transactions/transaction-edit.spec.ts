import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockCategoriesApi } from '../support/categories'
import { mockLabelsApi } from '../support/labels'
import { mockTransactionsApi, type TransactionApiMock } from '../support/transactions'
import { mockWalletsApi } from '../support/wallets'

const wallet = { id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false }
const categories = [
  { id: 'category-1', name: 'Jídlo', direction: 'expense' as const, iconKey: 'utensils', colorKey: 'orange', sortOrder: 0 },
  { id: 'category-2', name: 'Doprava', direction: 'expense' as const, iconKey: 'tram-front', colorKey: 'blue', sortOrder: 1 },
]

test('edits every transaction field and retries a failed update', async ({ page }) => {
  const transactionsApi = await openTransactionEdit(page)

  await expect(page.getByRole('textbox', { name: 'Částka', exact: true })).toHaveValue('230')
  await expect(page.getByLabel('Poznámka')).toHaveValue('Původní poznámka')
  await page.getByRole('textbox', { name: 'Částka', exact: true }).fill('1200')
  await page.getByRole('button', { name: 'Jídlo' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Doprava', exact: true }).click()
  await page.getByRole('button', { name: '20. 8. 2026' }).click()
  await page.locator('[data-slot="calendar-day"][aria-label="21. 8. 2026"]').click()
  await page.getByLabel('Poznámka').fill('Nová poznámka')

  transactionsApi.failNext('PATCH', { message: 'Změny jsou dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect(page.getByText('Transakci se nepodařilo upravit', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect.poll(() => transactionsApi.transactions()[0]).toMatchObject({
    walletId: wallet.id,
    categoryId: 'category-2',
    amountCzk: 1200,
    transactionDate: '2026-08-21',
    note: 'Nová poznámka',
  })
  await expect(page.getByRole('heading', { name: 'Transakce', exact: true })).toBeVisible()
})

test('cancels, retries, and completes transaction deletion', async ({ page }) => {
  const transactionsApi = await openTransactionEdit(page)

  await page.getByRole('button', { name: 'Smazat transakci' }).click()
  await page.getByRole('button', { name: 'Zrušit' }).click()
  await expect(page.getByRole('heading', { name: 'Upravit transakci' })).toBeVisible()

  transactionsApi.failNext('DELETE', { message: 'Smazání je dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Smazat transakci' }).click()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await expect(page.getByText('Transakci se nepodařilo smazat', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Zrušit' }).click()
  await page.getByRole('button', { name: 'Smazat transakci' }).click()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await expect.poll(() => transactionsApi.transactions()).toEqual([])
  await expect(page.getByText('Zatím bez transakcí', { exact: true })).toBeVisible()
})

async function openTransactionEdit(page: Parameters<typeof mockAuthAndApi>[0]): Promise<TransactionApiMock> {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  await mockCategoriesApi(page, categories)
  await mockLabelsApi(page, [{ id: 'label-1', name: 'oběd' }])
  const transactionsApi = await mockTransactionsApi(page, [{ id: 'transaction-1', walletId: wallet.id, walletName: wallet.name, categoryId: 'category-1', categoryName: 'Jídlo', categoryIconKey: 'utensils', categoryColorKey: 'orange', direction: 'expense', amountCzk: 230, transactionDate: '2026-08-20', note: 'Původní poznámka', labels: [{ id: 'label-1', name: 'oběd' }] }])
  await page.goto('/')
  await signIn(page)
  await page.getByRole('listitem').filter({ hasText: 'Jídlo' }).click()
  return transactionsApi
}
