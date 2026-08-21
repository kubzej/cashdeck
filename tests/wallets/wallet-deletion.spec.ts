import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockWalletsApi, type WalletFixture } from '../support/wallets'

const wallet: WalletFixture = {
  id: 'wallet-1',
  name: 'Hotovost',
  colorKey: 'teal',
  openingBalanceCzk: 5000,
  openingBalanceDate: '2024-05-10',
  sortOrder: 0,
  isHidden: false,
  openingBalanceLocked: false,
}

test('keeps a wallet when deletion is cancelled', async ({ page }) => {
  await openWalletEdit(page)

  await page.getByRole('button', { name: 'Smazat peněženku' }).click()
  await page.getByRole('button', { name: 'Zrušit' }).click()

  await expect(page.getByRole('heading', { name: 'Upravit peněženku' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Smazat peněženku' })).toBeVisible()
})

test('shows a deletion error and removes the wallet after retrying confirmation', async ({ page }) => {
  const walletApi = await openWalletEdit(page)
  walletApi.failNext('DELETE', { message: 'Smazání je dočasně nedostupné.' })

  await page.getByRole('button', { name: 'Smazat peněženku' }).click()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await expect(page.getByText('Peněženku se nepodařilo smazat', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Zrušit' }).click()
  await page.getByRole('button', { name: 'Smazat peněženku' }).click()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await expect(page.getByText('Zatím bez peněženek', { exact: true })).toBeVisible()
})

async function openWalletEdit(page: Parameters<typeof mockAuthAndApi>[0]) {
  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page, [wallet])
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('button', { name: `Spravovat peněženku ${wallet.name}` }).click()
  return walletApi
}
