import { expect, test } from '@playwright/test'
import type { FeedItem } from '../../src/features/feed/api'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockFeedApi } from '../support/feed'

const adjustment: FeedItem = {
  kind: 'balance_adjustment',
  id: 'adjustment-1',
  walletId: 'wallet-1',
  walletName: 'Běžný účet',
  amountCzk: 1544,
  operation: 'add',
  adjustmentDate: '2026-08-21',
}

test('shows a balance reconciliation as a read-only audit item in the transaction history', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockFeedApi(page, [adjustment])
  await page.goto('/')
  await signIn(page)

  const row = page.getByRole('listitem').filter({ hasText: 'Vyrovnání zůstatku' })
  await expect(row).toContainText('v Běžný účet')
  await expect(row).toContainText('+1 544 Kč')
  await expect(row).not.toHaveAttribute('data-interactive')
})
