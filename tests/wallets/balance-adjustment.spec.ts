import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockWalletsApi, type WalletFixture } from '../support/wallets'

const wallet: WalletFixture = {
  id: 'wallet-1',
  name: 'Běžný účet',
  colorKey: 'teal',
  openingBalanceCzk: 78000,
  currentBalanceCzk: 123456,
  openingBalanceDate: '2024-01-01',
  sortOrder: 0,
  isHidden: false,
  openingBalanceLocked: true,
}

test('reconciles a wallet from its actual balance without adding a manual transaction', async ({ page }) => {
  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page, [wallet])
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('button', { name: 'Vyrovnat zůstatek peněženky Běžný účet' }).click()

  await expect(page.getByRole('heading', { name: 'Vyrovnat zůstatek' })).toBeVisible()
  const dialog = page.getByLabel('Vyrovnat zůstatek', { exact: true })
  await expect(dialog.getByText('123 456 Kč', { exact: true })).toBeVisible()
  const actualBalance = page.getByLabel('Skutečný zůstatek', { exact: true })
  await expect(actualBalance).toHaveJSProperty('selectionStart', 0)
  await expect(actualBalance).toHaveJSProperty('selectionEnd', 7)
  await actualBalance.pressSequentially('125000')
  await expect(actualBalance).toHaveValue('125000')
  await expect(page.getByText('Přidá se 1 544 Kč.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Vyrovnat zůstatek', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Vyrovnat zůstatek' })).not.toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Běžný účet' })).toContainText('125 000 Kč')
  await expect.poll(() => walletApi.wallets()[0]?.currentBalanceCzk).toBe(125000)
})

test('reconciles a wallet downward when the actual balance is lower than recorded', async ({ page }) => {
  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page, [wallet])
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('button', { name: 'Vyrovnat zůstatek peněženky Běžný účet' }).click()

  const actualBalance = page.getByLabel('Skutečný zůstatek', { exact: true })
  await actualBalance.pressSequentially('120000')
  await expect(actualBalance).toHaveValue('120000')
  await expect(page.getByText('Odečte se 3 456 Kč.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Vyrovnat zůstatek', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Vyrovnat zůstatek' })).not.toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Běžný účet' })).toContainText('120 000 Kč')
  await expect.poll(() => walletApi.wallets()[0]?.currentBalanceCzk).toBe(120000)
  const adjustment = walletApi.lastRequestBody('POST') as { actualBalanceCzk: number }
  expect(adjustment.actualBalanceCzk).toBe(120000)
})

test('does not create a reconciliation when the wallet balance already matches', async ({ page }) => {
  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page, [wallet])
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('button', { name: 'Vyrovnat zůstatek peněženky Běžný účet' }).click()
  await expect(page.getByText('Zůstatek už souhlasí.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vyrovnat zůstatek', exact: true })).toBeDisabled()
  expect(walletApi.requestCount('POST')).toBe(0)
})

test('keeps the dialog open and explains a failed reconciliation', async ({ page }) => {
  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page, [wallet])
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('button', { name: 'Vyrovnat zůstatek peněženky Běžný účet' }).click()
  await page.getByLabel('Skutečný zůstatek', { exact: true }).fill('120000')
  walletApi.failNext('POST', { message: 'Služba je dočasně nedostupná.' })
  await page.getByRole('button', { name: 'Vyrovnat zůstatek', exact: true }).click()

  await expect(page.getByText('Vyrovnání se nepodařilo uložit', { exact: true })).toBeVisible()
  await expect(page.getByText('Služba je dočasně nedostupná.', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Vyrovnat zůstatek' })).toBeVisible()
})
