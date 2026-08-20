import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockWalletsApi, type WalletFixture } from '../support/wallets'

test('validates required wallet fields and retries a failed creation', async ({ page }) => {
  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.locator('[data-slot="empty-state"]').getByRole('button', { name: 'Přidat peněženku' }).click()
  await page.getByRole('button', { name: 'Uložit peněženku' }).click()

  await expect(page.getByText('Zadej název peněženky.', { exact: true })).toBeVisible()
  await expect(page.getByText('Zadej celý počet korun.', { exact: true })).toBeVisible()

  await page.getByLabel('Název').fill('Rezerva')
  await page.getByLabel('Počáteční zůstatek').fill('150000')
  walletApi.failNext('POST', { message: 'Uložení je dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Uložit peněženku' }).click()
  await expect(page.getByText('Peněženku se nepodařilo uložit', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Uložit peněženku' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Rezerva' })).toContainText('150 000 Kč')
})

test('edits every wallet field and preserves the updated opening-balance date', async ({ page }) => {
  const wallet: WalletFixture = {
    id: 'wallet-1',
    name: 'Rezerva',
    colorKey: 'teal',
    openingBalanceCzk: 150000,
    openingBalanceDate: '2022-01-15',
    sortOrder: 0,
    isHidden: false,
    openingBalanceLocked: false,
  }

  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page, [wallet])
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('listitem').filter({ hasText: 'Rezerva' }).click()
  await page.getByRole('button', { name: 'Upravit peněženku' }).click()
  await expect(page.getByRole('button', { name: '15. 1. 2022' })).toBeVisible()

  await page.getByLabel('Název').fill('Nouzová rezerva')
  await page.getByLabel('Červená', { exact: true }).click()
  await page.getByLabel('Počáteční zůstatek').fill('250000')
  await page.getByRole('button', { name: '15. 1. 2022' }).click()
  await page.getByRole('button', { name: 'Next month' }).click()
  await page.getByRole('button', { name: '1. 2. 2022', exact: true }).click()
  walletApi.failNext('PATCH', { message: 'Změny se nepodařilo uložit.' })
  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect(page.getByText('Peněženku se nepodařilo uložit', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect.poll(() => walletApi.wallets()[0]).toMatchObject({
    name: 'Nouzová rezerva',
    colorKey: 'red',
    openingBalanceCzk: 250000,
    openingBalanceDate: '2022-02-01',
  })

  await page.getByRole('listitem').filter({ hasText: 'Nouzová rezerva' }).click()
  await page.getByRole('button', { name: 'Upravit peněženku' }).click()
  await expect(page.getByRole('button', { name: '1. 2. 2022' })).toBeVisible()
})
