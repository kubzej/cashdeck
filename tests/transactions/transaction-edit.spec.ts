import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { feedItems, mockFeedApi } from '../support/feed'
import { mockCategoriesApi, type CategoryFixture } from '../support/categories'
import { mockLabelsApi } from '../support/labels'
import { mockTransactionsApi, type TransactionApiMock } from '../support/transactions'
import { mockTransfersApi } from '../support/transfers'
import { mockWalletsApi } from '../support/wallets'

const wallet = { id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false }
const categories: CategoryFixture[] = [
  { id: 'category-1', name: 'Jídlo', direction: 'expense', iconKey: 'utensils', colorKey: 'orange', sortOrder: 0 },
  { id: 'category-2', name: 'Doprava', direction: 'expense', iconKey: 'tram-front', colorKey: 'blue', sortOrder: 1 },
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
  await expect(page.getByText('V tomto období nic není', { exact: true })).toBeVisible()
})

async function openTransactionEdit(page: Parameters<typeof mockAuthAndApi>[0]): Promise<TransactionApiMock> {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  await mockCategoriesApi(page, categories)
  await mockLabelsApi(page, [{ id: 'label-1', name: 'oběd' }])
  const transactionsApi = await mockTransactionsApi(page, [{ id: 'transaction-1', walletId: wallet.id, walletName: wallet.name, categoryId: 'category-1', categoryName: 'Jídlo', categoryIconKey: 'utensils', categoryColorKey: 'orange', direction: 'expense', amountCzk: 230, transactionDate: '2026-08-20', note: 'Původní poznámka', labels: [{ id: 'label-1', name: 'oběd' }] }])
  const transfersApi = await mockTransfersApi(page)
  await mockFeedApi(page, () => feedItems(transactionsApi.transactions(), transfersApi.transfers()))
  await page.goto('/')
  await signIn(page)
  await page.getByRole('listitem').filter({ hasText: 'Jídlo' }).click()
  return transactionsApi
}

test('opens a transaction that has more than eight labels with all of them selected and removable', async ({ page }) => {
  const manyLabels = Array.from({ length: 10 }, (_, index) => ({ id: `label-${index + 1}`, name: `štítek ${index + 1}` }))
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  await mockCategoriesApi(page, categories)
  await mockLabelsApi(page, manyLabels)
  const transactionsApi = await mockTransactionsApi(page, [{ id: 'transaction-1', walletId: wallet.id, walletName: wallet.name, categoryId: 'category-1', categoryName: 'Jídlo', categoryIconKey: 'utensils', categoryColorKey: 'orange', direction: 'expense', amountCzk: 230, transactionDate: '2026-08-20', note: null, labels: manyLabels }])
  const transfersApi = await mockTransfersApi(page)
  await mockFeedApi(page, () => feedItems(transactionsApi.transactions(), transfersApi.transfers()))
  await page.goto('/')
  await signIn(page)
  await page.getByRole('listitem').filter({ hasText: 'Jídlo' }).click()

  const selectedChips = page.locator('.transaction-label-chip--selected')
  await expect(selectedChips).toHaveCount(10)

  await selectedChips.filter({ hasText: 'štítek 10' }).click()
  await expect(selectedChips).toHaveCount(9)
  const update = page.waitForRequest((request) => request.method() === 'PATCH' && request.url().includes('/api/transactions/'))
  await page.getByRole('button', { name: 'Uložit změny' }).click()

  expect((await update).postDataJSON().labelIds).toEqual(manyLabels.slice(0, 9).map((label) => label.id))
})

async function openListWithSearch(page: Parameters<typeof mockAuthAndApi>[0]) {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  await mockCategoriesApi(page, categories)
  await mockLabelsApi(page, [])
  const transactionsApi = await mockTransactionsApi(page, [{ id: 'transaction-1', walletId: wallet.id, walletName: wallet.name, categoryId: 'category-1', categoryName: 'Jídlo', categoryIconKey: 'utensils', categoryColorKey: 'orange', direction: 'expense', amountCzk: 230, transactionDate: '2026-08-20', note: null, labels: [] }])
  const transfersApi = await mockTransfersApi(page)
  const feedApi = await mockFeedApi(page, () => feedItems(transactionsApi.transactions(), transfersApi.transfers()))
  await page.goto('/')
  await signIn(page)
  await page.getByLabel('Hledat v transakcích').fill('jídlo')
  await expect.poll(() => feedApi.requests().at(-1)?.searchParams.get('search')).toBe('jídlo')
  return feedApi
}

test('keeps the list filters when a transaction is opened and closed again', async ({ page }) => {
  const feedApi = await openListWithSearch(page)

  await page.getByRole('listitem').filter({ hasText: 'Jídlo' }).click()
  await page.getByRole('button', { name: 'Zpět na transakce' }).click()

  await expect(page.getByLabel('Hledat v transakcích')).toHaveValue('jídlo')
  await expect.poll(() => feedApi.requests().at(-1)?.searchParams.get('search')).toBe('jídlo')
})

test('coming back to the list from another tab starts from the default filters', async ({ page }) => {
  const feedApi = await openListWithSearch(page)

  await page.locator('.bottom-nav').getByRole('button', { name: 'Peněženky', exact: true }).click()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Transakce', exact: true }).click()

  await expect(page.getByLabel('Hledat v transakcích')).toHaveValue('')
  await expect.poll(() => feedApi.requests().at(-1)?.searchParams.get('search')).toBeNull()
})
