import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockCategoriesApi } from '../support/categories'
import { mockLabelsApi } from '../support/labels'
import { mockRecurringRulesApi } from '../support/recurring'
import { mockTransactionsApi } from '../support/transactions'
import { mockTransfersApi } from '../support/transfers'
import { mockWalletsApi } from '../support/wallets'

test('creates a recurring transfer and prevents using one wallet on both sides', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, wallets)
  await mockCategoriesApi(page)
  await mockLabelsApi(page, [{ id: 'label-1', name: 'spoření' }])
  await mockTransactionsApi(page)
  await mockTransfersApi(page)
  const recurringApi = await mockRecurringRulesApi(page)
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: /Opakování/ }).click()
  await page.getByRole('button', { name: 'Přidat opakování' }).click()

  await page.getByLabel('Název').fill('Přesun do rezervy')
  await page.getByRole('button', { name: 'Převod', exact: true }).click()
  await page.getByRole('textbox', { name: 'Částka', exact: true }).fill('5000')
  await page.locator('.transfer-wallet-pickers .transaction-primary-picker').nth(1).getByRole('button', { name: 'Rezerva', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Běžný účet', exact: true }).click()
  await page.getByRole('button', { name: 'Uložit opakování' }).click()
  await expect(page.getByText('Vyber jinou cílovou peněženku.', { exact: true })).toBeVisible()

  await page.locator('.transfer-wallet-pickers .transaction-primary-picker').nth(1).getByRole('button', { name: 'Běžný účet', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Rezerva', exact: true }).click()
  await page.getByRole('combobox', { name: 'Opakování', exact: true }).click()
  await page.getByRole('option', { name: 'Vlastní interval', exact: true }).click()
  await page.getByRole('textbox', { name: 'Opakování', exact: true }).fill('14')
  await page.getByRole('button', { name: 'Uložit opakování' }).click()

  await expect.poll(() => recurringApi.rules()).toEqual([
    expect.objectContaining({
      name: 'Přesun do rezervy', kind: 'transfer', amountCzk: 5000,
      sourceWalletId: wallets[0].id, destinationWalletId: wallets[1].id,
      frequency: 'custom_days', customIntervalDays: 14,
    }),
  ])
  await expect(page.getByRole('listitem').filter({ hasText: 'Přesun do rezervy' })).toContainText('Každých 14 dní')
})

const wallets = [
  { id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false },
  { id: 'wallet-2', name: 'Rezerva', colorKey: 'blue', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 1, isHidden: false, openingBalanceLocked: false },
]
