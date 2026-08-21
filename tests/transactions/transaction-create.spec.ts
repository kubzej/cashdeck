import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockCategoriesApi } from '../support/categories'
import { mockLabelsApi } from '../support/labels'
import { mockTransactionsApi } from '../support/transactions'
import { mockTransfersApi } from '../support/transfers'
import { mockWalletsApi } from '../support/wallets'

test('validates, creates a label inline, and retries a failed transaction creation', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  await mockCategoriesApi(page, [expenseCategory])
  const labelsApi = await mockLabelsApi(page, [{ id: 'label-1', name: 'oběd' }])
  const transactionsApi = await mockTransactionsApi(page)
  await mockTransfersApi(page)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Přidat záznam' }).click()
  await page.getByRole('button', { name: 'Transakce', exact: true }).click()
  await page.getByRole('button', { name: 'Uložit transakci' }).click()
  await expect(page.getByText('Vyber kategorii.', { exact: true })).toBeVisible()
  await expect(page.getByText('Zadej celý počet korun větší než nula.', { exact: true })).toBeVisible()

  await page.getByRole('textbox', { name: 'Částka', exact: true }).fill('1290')
  await page.getByRole('button', { name: 'Vyber kategorii' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Jídlo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Hledat nebo vytvořit štítek' }).fill('slavia')
  await page.getByRole('button', { name: 'Vytvořit „slavia“' }).click()
  await expect(page.getByRole('button', { name: 'slavia' })).toHaveClass(/transaction-label-chip--selected/)

  transactionsApi.failNext('POST', { message: 'Uložení je dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Uložit transakci' }).click()
  await expect(page.getByText('Transakci se nepodařilo uložit', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Uložit transakci' }).click()
  await expect.poll(() => transactionsApi.transactions()).toEqual([
    expect.objectContaining({ walletId: wallet.id, categoryId: expenseCategory.id, amountCzk: 1290 }),
  ])
  expect(labelsApi.labels()).toContainEqual(expect.objectContaining({ name: 'slavia' }))
  await expect(page.getByRole('heading', { name: 'Transakce', exact: true })).toBeVisible()
})

test('rejects a decimal point in the amount instead of silently merging the digits', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  await mockCategoriesApi(page, [expenseCategory])
  await mockLabelsApi(page, [])
  const transactionsApi = await mockTransactionsApi(page)
  await mockTransfersApi(page)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Přidat záznam' }).click()
  await page.getByRole('button', { name: 'Transakce', exact: true }).click()
  const amount = page.getByRole('textbox', { name: 'Částka', exact: true })
  await amount.pressSequentially('99')
  await amount.press('.')
  await expect(amount).toHaveValue('99')
  await expect(page.getByText('Zadej celé koruny bez desetinných míst.', { exact: true })).toBeVisible()

  await amount.fill('99.90')
  await expect(page.getByText('Zadej celé koruny bez desetinných míst.', { exact: true })).toBeVisible()
  expect(transactionsApi.transactions()).toEqual([])
})

test('rejects a transaction date before the selected wallet was opened', async ({ page }) => {
  const futureWallet = { ...wallet, openingBalanceDate: '2030-01-01' }
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [futureWallet])
  await mockCategoriesApi(page, [expenseCategory])
  await mockLabelsApi(page, [])
  const transactionsApi = await mockTransactionsApi(page)
  await mockTransfersApi(page)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Přidat záznam' }).click()
  await page.getByRole('button', { name: 'Transakce', exact: true }).click()
  await page.getByRole('textbox', { name: 'Částka', exact: true }).fill('100')
  await page.getByRole('button', { name: 'Vyber kategorii' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Jídlo', exact: true }).click()

  await page.getByRole('button', { name: 'Uložit transakci' }).click()
  await expect(page.getByText('Datum nemůže být před založením peněženky.', { exact: true })).toBeVisible()
  expect(transactionsApi.transactions()).toEqual([])
})

const wallet = { id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false }
const expenseCategory = { id: 'category-1', name: 'Jídlo', direction: 'expense' as const, iconKey: 'utensils', colorKey: 'orange', sortOrder: 0 }
