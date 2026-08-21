import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockLabelsApi } from '../support/labels'
import { mockTransactionsApi } from '../support/transactions'
import { mockTransfersApi } from '../support/transfers'
import { mockWalletsApi } from '../support/wallets'

test('validates, creates a label inline, and retries a failed transfer creation', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, wallets)
  const labelsApi = await mockLabelsApi(page, [{ id: 'label-1', name: 'spoření' }])
  await mockTransactionsApi(page)
  const transfersApi = await mockTransfersApi(page)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Přidat záznam' }).click()
  await page.getByRole('button', { name: 'Převod', exact: true }).click()
  await page.getByRole('button', { name: 'Uložit převod' }).click()
  await expect(page.getByText('Zadej celý počet korun větší než nula.', { exact: true })).toBeVisible()

  await page.getByRole('textbox', { name: 'Částka', exact: true }).fill('25000')
  await page.locator('.transfer-wallet-pickers .transaction-primary-picker').nth(1).getByRole('button', { name: 'Spoření', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Běžný účet', exact: true }).click()
  await page.getByRole('button', { name: 'Uložit převod' }).click()
  await expect(page.getByText('Vyber jinou cílovou peněženku.', { exact: true })).toBeVisible()
  await page.locator('.transfer-wallet-pickers .transaction-primary-picker').nth(1).getByRole('button', { name: 'Běžný účet', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Spoření', exact: true }).click()
  await page.getByRole('textbox', { name: 'Hledat nebo vytvořit štítek' }).fill('rezerva')
  await page.getByRole('button', { name: 'Vytvořit „rezerva“' }).click()

  transfersApi.failNext('POST', { message: 'Uložení je dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Uložit převod' }).click()
  await expect(page.getByText('Převod se nepodařilo uložit', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Uložit převod' }).click()
  await expect.poll(() => transfersApi.transfers()).toEqual([
    expect.objectContaining({ sourceWalletId: wallets[0].id, destinationWalletId: wallets[1].id, amountCzk: 25000 }),
  ])
  expect(labelsApi.labels()).toContainEqual(expect.objectContaining({ name: 'rezerva' }))
  await expect(page.getByRole('heading', { name: 'Transakce', exact: true })).toBeVisible()
})

test('rejects a transfer date before either wallet was opened', async ({ page }) => {
  const futureWallets = [wallets[0], { ...wallets[1], openingBalanceDate: '2030-01-01' }]
  await mockAuthAndApi(page)
  await mockWalletsApi(page, futureWallets)
  await mockLabelsApi(page, [])
  await mockTransactionsApi(page)
  const transfersApi = await mockTransfersApi(page)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Přidat záznam' }).click()
  await page.getByRole('button', { name: 'Převod', exact: true }).click()
  await page.getByRole('textbox', { name: 'Částka', exact: true }).fill('1000')

  await page.getByRole('button', { name: 'Uložit převod' }).click()
  await expect(page.getByText('Datum nemůže být před založením peněženky.', { exact: true })).toBeVisible()
  expect(transfersApi.transfers()).toEqual([])
})

const wallets = [
  { id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false },
  { id: 'wallet-2', name: 'Spoření', colorKey: 'blue', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 1, isHidden: false, openingBalanceLocked: false },
]
