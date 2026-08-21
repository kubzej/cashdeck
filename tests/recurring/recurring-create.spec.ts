import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockCategoriesApi } from '../support/categories'
import { mockLabelsApi } from '../support/labels'
import { mockRecurringRulesApi } from '../support/recurring'
import { mockTransactionsApi } from '../support/transactions'
import { mockTransfersApi } from '../support/transfers'
import { mockWalletsApi } from '../support/wallets'

test('validates, creates labels inline, retries, and saves a recurring transaction', async ({ page }) => {
  const { recurringApi, labelsApi } = await openRecurringManager(page)

  await expect(page.getByText('Bez opakování', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Přidat opakování' }).click()
  await page.getByRole('button', { name: 'Uložit opakování' }).click()
  await expect(page.getByText('Zadej název opakování.', { exact: true })).toBeVisible()
  await expect(page.getByText('Zadej celý počet korun větší než nula.', { exact: true })).toBeVisible()
  await expect(page.getByText('Vyber kategorii.', { exact: true })).toBeVisible()

  await page.getByLabel('Název').fill('Nájem')
  await page.getByRole('textbox', { name: 'Částka', exact: true }).fill('23 000')
  await page.getByRole('button', { name: 'Vyber kategorii' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Domov', exact: true }).click()
  await page.getByRole('textbox', { name: 'Hledat nebo vytvořit štítek' }).fill('nájem')
  await page.getByRole('button', { name: 'Vytvořit „nájem“' }).click()
  await page.getByLabel('Poznámka').fill('Trvalá platba')
  await page.getByRole('button', { name: 'K datu' }).click()

  recurringApi.failNext('POST', { message: 'Uložení je dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Uložit opakování' }).click()
  await expect(page.getByText('Opakování se nepodařilo uložit', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Uložit opakování' }).click()
  await expect.poll(() => recurringApi.rules()).toEqual([
    expect.objectContaining({
      name: 'Nájem', kind: 'transaction', amountCzk: 23000,
      walletId: wallets[0].id, categoryId: 'category-home', note: 'Trvalá platba',
      frequency: 'monthly', endsOn: expect.any(String),
    }),
  ])
  expect(labelsApi.labels()).toContainEqual(expect.objectContaining({ name: 'nájem' }))
  await expect(page.getByText('Nájem', { exact: true })).toBeVisible()
  await expect(page.getByText('Končí', { exact: false })).toBeVisible()
})

const wallets = [
  { id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false },
  { id: 'wallet-2', name: 'Rezerva', colorKey: 'blue', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 1, isHidden: false, openingBalanceLocked: false },
]

async function openRecurringManager(page: Parameters<typeof mockAuthAndApi>[0]) {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, wallets)
  await mockCategoriesApi(page, [
    { id: 'category-home', name: 'Domov', direction: 'expense', iconKey: 'house', colorKey: 'orange', sortOrder: 0 },
    { id: 'category-income', name: 'Výplata', direction: 'income', iconKey: 'banknote', colorKey: 'green', sortOrder: 0 },
  ])
  const labelsApi = await mockLabelsApi(page, [{ id: 'label-1', name: 'bydlení' }])
  await mockTransactionsApi(page)
  await mockTransfersApi(page)
  const recurringApi = await mockRecurringRulesApi(page)
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: /Opakování/ }).click()
  await expect(page.getByRole('heading', { name: 'Opakování', exact: true })).toBeVisible()
  return { recurringApi, labelsApi }
}
