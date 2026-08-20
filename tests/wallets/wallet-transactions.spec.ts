import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockFeedApi } from '../support/feed'
import { mockWalletsApi, type WalletFixture } from '../support/wallets'

test('opens Transactions with the selected wallet prefiltered', async ({ page }) => {
  const wallet: WalletFixture = {
    id: 'wallet-1',
    name: 'Běžný účet',
    colorKey: 'teal',
    openingBalanceCzk: 12000,
    openingBalanceDate: '2024-01-01',
    sortOrder: 0,
    isHidden: false,
    openingBalanceLocked: false,
  }

  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  const feedApi = await mockFeedApi(page)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('listitem').filter({ hasText: wallet.name }).click()

  await expect(page.getByRole('heading', { name: 'Transakce' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nastavit filtr účtů' })).toContainText(wallet.name)
  await expect.poll(() => feedApi.requests().length).toBe(2)
  expect(feedApi.requests()[1].searchParams.get('walletIds')).toBe(wallet.id)
})
