import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockRecurringRulesApi } from '../support/recurring'

test('shows an ended recurring rule as historical schedule data', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockRecurringRulesApi(page, [endedRule])
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: /Opakování/ }).click()

  const row = page.getByRole('button', { name: /Nájem/ })
  await expect(row).toContainText('Ukončeno')
  await expect(row).toContainText('Ukončeno 20. srpna 2026')
  await expect(row).toContainText('bydlení')
  await expect(row).toContainText('Historická poznámka')
})

const endedRule = {
  id: 'rule-ended', name: 'Nájem', kind: 'transaction' as const, amountCzk: 18000,
  walletId: 'wallet-1', walletName: 'Běžný účet', categoryId: 'category-home', categoryName: 'Domov',
  categoryIconKey: 'house', categoryColorKey: 'orange', categoryDirection: 'expense' as const,
  sourceWalletId: null, sourceWalletName: null, destinationWalletId: null, destinationWalletName: null,
  note: 'Historická poznámka', labels: [{ id: 'label-1', name: 'bydlení' }], frequency: 'monthly' as const,
  customIntervalDays: null, nextOccurrenceDate: '2026-09-20', endsOn: '2026-08-20', status: 'ended' as const,
}
