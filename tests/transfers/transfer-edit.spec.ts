import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { feedItems, mockFeedApi } from '../support/feed'
import { mockLabelsApi } from '../support/labels'
import { mockTransactionsApi } from '../support/transactions'
import { mockTransfersApi, type TransferApiMock } from '../support/transfers'
import { mockWalletsApi } from '../support/wallets'

test('edits every transfer field and retries a failed update', async ({ page }) => {
  const transfersApi = await openTransferEdit(page)

  await page.getByRole('textbox', { name: 'Částka', exact: true }).fill('18000')
  await page.locator('.transfer-wallet-pickers .transaction-primary-picker').nth(1).getByRole('button', { name: 'Spoření', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Investice', exact: true }).click()
  await page.getByRole('button', { name: '20. 8. 2026' }).click()
  await page.locator('[data-slot="calendar-day"][aria-label="21. 8. 2026"]').click()
  await page.getByLabel('Poznámka').fill('Přesun do investic')

  transfersApi.failNext('PATCH', { message: 'Změny jsou dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect(page.getByText('Převod se nepodařilo upravit', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect.poll(() => transfersApi.transfers()[0]).toMatchObject({ destinationWalletId: 'wallet-3', amountCzk: 18000, transferDate: '2026-08-21', note: 'Přesun do investic' })
  await expect(page.getByRole('heading', { name: 'Transakce', exact: true })).toBeVisible()
})

test('cancels, retries, and completes transfer deletion', async ({ page }) => {
  const transfersApi = await openTransferEdit(page)

  await page.getByRole('button', { name: 'Smazat převod' }).click()
  await page.getByRole('button', { name: 'Zrušit' }).click()
  await expect(page.getByRole('heading', { name: 'Upravit převod' })).toBeVisible()

  transfersApi.failNext('DELETE', { message: 'Smazání je dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Smazat převod' }).click()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await expect(page.getByText('Převod se nepodařilo smazat', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Zrušit' }).click()
  await page.getByRole('button', { name: 'Smazat převod' }).click()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await expect.poll(() => transfersApi.transfers()).toEqual([])
})

async function openTransferEdit(page: Parameters<typeof mockAuthAndApi>[0]): Promise<TransferApiMock> {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, wallets)
  await mockLabelsApi(page, [{ id: 'label-1', name: 'spoření' }])
  const transactionsApi = await mockTransactionsApi(page)
  const transfersApi = await mockTransfersApi(page, [{ id: 'transfer-1', sourceWalletId: 'wallet-1', sourceWalletName: 'Běžný účet', destinationWalletId: 'wallet-2', destinationWalletName: 'Spoření', amountCzk: 15000, transferDate: '2026-08-20', note: 'Původní poznámka', labels: [{ id: 'label-1', name: 'spoření' }] }])
  await mockFeedApi(page, () => feedItems(transactionsApi.transactions(), transfersApi.transfers()))
  await page.goto('/')
  await signIn(page)
  await page.getByRole('listitem').filter({ hasText: 'Převod' }).click()
  return transfersApi
}

const wallets = [
  { id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false },
  { id: 'wallet-2', name: 'Spoření', colorKey: 'blue', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 1, isHidden: false, openingBalanceLocked: false },
  { id: 'wallet-3', name: 'Investice', colorKey: 'purple', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 2, isHidden: false, openingBalanceLocked: false },
]
