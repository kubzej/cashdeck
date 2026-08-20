import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockFeedApi } from '../support/feed'

test('shows a transfer in the shared timeline and opens its edit screen', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockFeedApi(page, [{ kind: 'transfer', id: 'transfer-1', sourceWalletId: 'wallet-1', sourceWalletName: 'Běžný účet', destinationWalletId: 'wallet-2', destinationWalletName: 'Spoření', amountCzk: 1200, impactCzk: 0, transferDate: '2026-08-20', note: 'Měsíční rezerva', labels: [{ id: 'label-1', name: 'rezerva' }] }])
  await page.goto('/')
  await signIn(page)

  const row = page.getByRole('listitem').filter({ hasText: 'Převod' })
  await expect(row).toContainText('z Běžný účet do Spoření')
  await expect(row).toContainText('1 200 Kč')
  await expect(row).toContainText('rezerva')
  await expect(row).toContainText('Měsíční rezerva')
  await row.click()
  await expect(page.getByRole('heading', { name: 'Upravit převod' })).toBeVisible()
})
