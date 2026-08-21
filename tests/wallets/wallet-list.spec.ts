import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockWalletsApi, type WalletFixture } from '../support/wallets'

test('shows the empty state after retrying a failed wallet load', async ({ page }) => {
  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page)
  await page.goto('/')
  await signIn(page)

  await expect.poll(() => walletApi.requestCount('GET')).toBe(1)
  walletApi.failNext('GET', { message: 'Dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Peněženky', exact: true }).click()
  await expect(page.getByText('Peněženky se nepodařilo načíst', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zkusit znovu' }).click()

  await expect(page.getByText('Zatím bez peněženek', { exact: true })).toBeVisible()
  await expect(page.locator('[data-slot="empty-state"]').getByRole('button', { name: 'Přidat peněženku' })).toBeVisible()
})

test('reorders wallets with the drag handle and saves the new order', async ({ page }) => {
  const wallets: WalletFixture[] = [
    wallet('wallet-1', 'AirBank', 0),
    wallet('wallet-2', 'Hotovost', 1),
  ]

  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page, wallets)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  const source = page.getByRole('button', { name: 'Změnit pořadí peněženky AirBank' })
  const target = page.getByRole('button', { name: 'Změnit pořadí peněženky Hotovost' })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Drag handle peněženky není viditelný.')

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 + 12, { steps: 4 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
  await page.mouse.up()

  await expect(page.getByRole('listitem').first()).toContainText('Hotovost')
  await expect.poll(() => walletApi.wallets().map((wallet) => wallet.id)).toEqual(['wallet-2', 'wallet-1'])
})

test('shows the current balance instead of the opening balance', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [{
    ...wallet('wallet-1', 'Běžný účet', 0),
    openingBalanceCzk: 78000,
    currentBalanceCzk: 123456,
  }])
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Běžný účet' })).toContainText(/123\s456\sKč/)
  await expect(page.getByRole('listitem').filter({ hasText: 'Běžný účet' })).not.toContainText(/78\s000\sKč/)
})

function wallet(id: string, name: string, sortOrder: number): WalletFixture {
  return {
    id,
    name,
    colorKey: 'teal',
    openingBalanceCzk: 5000,
    openingBalanceDate: '2024-05-10',
    sortOrder,
    isHidden: false,
    openingBalanceLocked: false,
  }
}
