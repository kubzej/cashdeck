import { expect, test, type Page } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockCategoriesApi } from '../support/categories'
import { mockLabelsApi } from '../support/labels'
import { mockTransactionsApi } from '../support/transactions'
import { mockWalletsApi } from '../support/wallets'

test('new and edit transaction forms keep the same layout and load their data once', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [{ id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false }])
  await mockCategoriesApi(page, [{ id: 'category-1', name: 'Jídlo', direction: 'expense', iconKey: 'utensils', colorKey: 'orange', sortOrder: 0 }])
  await mockLabelsApi(page, [{ id: 'label-1', name: 'oběd' }])
  await mockTransactionsApi(page, [{ id: 'transaction-1', walletId: 'wallet-1', walletName: 'Běžný účet', categoryId: 'category-1', categoryName: 'Jídlo', categoryIconKey: 'utensils', categoryColorKey: 'orange', direction: 'expense', amountCzk: 230, transactionDate: '2026-08-20', note: null, labels: [{ id: 'label-1', name: 'oběd' }] }])

  const formDataRequests = new Map<string, number>()
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (request.method() === 'GET' && ['/api/wallets', '/api/categories', '/api/labels'].includes(pathname)) formDataRequests.set(pathname, (formDataRequests.get(pathname) ?? 0) + 1)
  })

  await page.goto('/')
  await signIn(page)

  const transactionFab = page.getByRole('button', { name: 'Přidat transakci' })
  await expect(transactionFab).toBeVisible()
  await expect(transactionFab).toHaveClass(/transaction-fab/)
  const fabBounds = await transactionFab.boundingBox()
  const navBounds = await page.locator('.bottom-nav').boundingBox()
  expect(fabBounds).not.toBeNull()
  expect(navBounds).not.toBeNull()
  expect(fabBounds!.y + fabBounds!.height).toBeLessThan(navBounds!.y)

  await transactionFab.click()
  await expect(page.getByRole('heading', { name: 'Nová transakce' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Běžný účet' })).toBeVisible()
  const newLayout = await formLayout(page)
  await expect.poll(() => formRequestCount(formDataRequests)).toBe(3)

  await page.getByRole('button', { name: 'Zpět na transakce' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Jídlo' })).toBeVisible()
  const countBeforeEdit = formRequestCount(formDataRequests)

  await page.getByRole('listitem').filter({ hasText: 'Jídlo' }).click()
  await expect(page.getByRole('heading', { name: 'Upravit transakci' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Běžný účet' })).toBeVisible()
  const editLayout = await formLayout(page)
  await page.waitForTimeout(150)

  expect(editLayout).toEqual(newLayout)
  expect(formRequestCount(formDataRequests) - countBeforeEdit).toBe(3)
})

async function formLayout(page: Page) {
  const header = await page.locator('.transaction-form-header').boundingBox()
  const amountPanel = await page.locator('.transaction-amount-panel').boundingBox()
  const primaryPickers = await page.locator('.transaction-primary-pickers').boundingBox()
  expect(header).not.toBeNull()
  expect(amountPanel).not.toBeNull()
  expect(primaryPickers).not.toBeNull()

  return {
    headerY: header!.y,
    amountPanelY: amountPanel!.y,
    primaryPickersY: primaryPickers!.y,
  }
}

function formRequestCount(requests: Map<string, number>) {
  return [...requests.values()].reduce((total, count) => total + count, 0)
}
