import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockCategoriesApi } from '../support/categories'
import { mockLabelsApi } from '../support/labels'
import { mockTransactionsApi } from '../support/transactions'
import { mockTransfersApi } from '../support/transfers'
import { mockWalletsApi, type WalletFixture } from '../support/wallets'

const walletWithHistory: WalletFixture = {
  id: 'wallet-1',
  name: 'AirBank',
  colorKey: 'teal',
  openingBalanceCzk: 5000,
  openingBalanceDate: '2024-05-10',
  sortOrder: 0,
  isHidden: false,
  openingBalanceLocked: true,
}

test('hides a wallet with history instead of deleting it, and it moves to the hidden section', async ({ page }) => {
  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page, [walletWithHistory])
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('button', { name: `Spravovat peněženku ${walletWithHistory.name}` }).click()

  await expect(page.getByRole('button', { name: 'Smazat peněženku' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Skrýt peněženku' }).click()

  await expect.poll(() => walletApi.lastRequestBody('PATCH')).toEqual({ isHidden: true })
  await expect(page.getByRole('heading', { name: 'Peněženky', exact: true })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: walletWithHistory.name })).toHaveCount(0)

  const hiddenToggle = page.getByRole('button', { name: 'Skryté peněženky (1)' })
  await expect(hiddenToggle).toBeVisible()
  await hiddenToggle.click()
  await expect(page.getByRole('listitem').filter({ hasText: walletWithHistory.name })).toBeVisible()
})

test('unhides a wallet from the hidden section and it reappears in the visible list', async ({ page }) => {
  const hiddenWallet: WalletFixture = { ...walletWithHistory, isHidden: true }
  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page, [hiddenWallet])
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: hiddenWallet.name })).toHaveCount(0)
  await page.getByRole('button', { name: 'Skryté peněženky (1)' }).click()
  await page.getByRole('button', { name: 'Zobrazit', exact: true }).click()

  await expect.poll(() => walletApi.lastRequestBody('PATCH')).toEqual({ isHidden: false })
  await expect(page.getByRole('button', { name: /Skryté peněženky/ })).toHaveCount(0)
  await expect(page.getByRole('listitem').filter({ hasText: hiddenWallet.name })).toBeVisible()
})

test('offers to unhide instead of delete when editing an already-hidden wallet', async ({ page }) => {
  const hiddenWallet: WalletFixture = { ...walletWithHistory, isHidden: true }
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [hiddenWallet])
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('button', { name: 'Skryté peněženky (1)' }).click()
  await page.getByRole('button', { name: `Spravovat peněženku ${hiddenWallet.name}` }).click()

  await expect(page.getByRole('button', { name: 'Smazat peněženku' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Skrýt peněženku' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Zobrazit peněženku' })).toBeVisible()
})

test('shows an error and stays on the form when hiding a wallet fails', async ({ page }) => {
  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page, [walletWithHistory])
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('button', { name: `Spravovat peněženku ${walletWithHistory.name}` }).click()
  walletApi.failNext('PATCH', { message: 'Skrytí je dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Skrýt peněženku' }).click()

  await expect(page.getByText('Skrytí je dočasně nedostupné.', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Upravit peněženku' })).toBeVisible()
})

test('excludes a hidden wallet from the transaction wallet picker', async ({ page }) => {
  const visibleWallet: WalletFixture = { id: 'wallet-1', name: 'Hotovost', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2024-05-10', sortOrder: 0, isHidden: false, openingBalanceLocked: false }
  const hiddenWallet: WalletFixture = { id: 'wallet-2', name: 'Starý účet', colorKey: 'blue', openingBalanceCzk: 0, openingBalanceDate: '2024-05-10', sortOrder: 1, isHidden: true, openingBalanceLocked: true }
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [visibleWallet, hiddenWallet])
  await mockCategoriesApi(page, [])
  await mockLabelsApi(page, [])
  await mockTransactionsApi(page)
  await mockTransfersApi(page)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Přidat záznam' }).click()
  await page.getByRole('button', { name: 'Transakce', exact: true }).click()
  await page.getByRole('button', { name: visibleWallet.name, exact: true }).click()

  await expect(page.getByRole('dialog').getByRole('button', { name: visibleWallet.name })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: hiddenWallet.name })).toHaveCount(0)
})

test('reorders visible wallets while a hidden wallet stays out of the drag list and survives the reorder', async ({ page }) => {
  const walletA: WalletFixture = { id: 'wallet-1', name: 'AirBank', colorKey: 'teal', openingBalanceCzk: 5000, openingBalanceDate: '2024-05-10', sortOrder: 0, isHidden: false, openingBalanceLocked: false }
  const walletB: WalletFixture = { id: 'wallet-2', name: 'Hotovost', colorKey: 'blue', openingBalanceCzk: 5000, openingBalanceDate: '2024-05-10', sortOrder: 1, isHidden: false, openingBalanceLocked: false }
  const hiddenWallet: WalletFixture = { id: 'wallet-3', name: 'Starý účet', colorKey: 'orange', openingBalanceCzk: 5000, openingBalanceDate: '2024-05-10', sortOrder: 2, isHidden: true, openingBalanceLocked: true }
  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page, [walletA, walletB, hiddenWallet])
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: hiddenWallet.name })).toHaveCount(0)

  const source = page.getByRole('button', { name: `Změnit pořadí peněženky ${walletA.name}` })
  const target = page.getByRole('button', { name: `Změnit pořadí peněženky ${walletB.name}` })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Drag handle peněženky není viditelný.')

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 + 12, { steps: 4 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
  await page.mouse.up()

  await expect.poll(() => walletApi.wallets().map((wallet) => wallet.id)).toEqual(['wallet-2', 'wallet-1', 'wallet-3'])
  await expect.poll(() => walletApi.wallets().find((wallet) => wallet.id === 'wallet-3')?.isHidden).toBe(true)
})
