import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockFeedApi } from '../support/feed'
import { mockWalletsApi } from '../support/wallets'

test('shows a transfer as an expense when viewing its source wallet', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [
    { id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false },
    { id: 'wallet-2', name: 'Spoření', colorKey: 'blue', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 1, isHidden: false, openingBalanceLocked: false },
  ])
  await mockFeedApi(page, [{ kind: 'transfer', id: 'transfer-1', sourceWalletId: 'wallet-1', sourceWalletName: 'Běžný účet', destinationWalletId: 'wallet-2', destinationWalletName: 'Spoření', amountCzk: 1200, impactCzk: -1200, transferDate: '2026-08-20', note: null, labels: [] }])
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('listitem').filter({ hasText: 'Běžný účet' }).click()

  await expect(page.getByRole('listitem').filter({ hasText: 'Převod' })).toContainText('-1 200 Kč')
})
