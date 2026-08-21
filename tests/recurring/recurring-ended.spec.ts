import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockCategoriesApi } from '../support/categories'
import { mockLabelsApi } from '../support/labels'
import { mockRecurringRulesApi } from '../support/recurring'
import { mockWalletsApi } from '../support/wallets'

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

test('edits an ended recurring rule\'s name without its frozen schedule being re-validated', async ({ page }) => {
  await mockAuthAndApi(page)
  const rulesApi = await mockRecurringRulesApi(page, [endedRule])
  await mockWalletsApi(page, [{ id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false }])
  await mockCategoriesApi(page, [{ id: 'category-home', name: 'Domov', direction: 'expense', iconKey: 'house', colorKey: 'orange', sortOrder: 0 }])
  await mockLabelsApi(page, [{ id: 'label-1', name: 'bydlení' }])
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: /Opakování/ }).click()

  await page.getByRole('button', { name: /Nájem/ }).click()
  await expect(page.getByRole('heading', { name: 'Upravit opakování' })).toBeVisible()
  await expect(page.getByText('Další výskyt musí být dnes nebo v budoucnu.', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Konec nesmí být před dalším výskytem.', { exact: true })).toHaveCount(0)

  await page.getByLabel('Název').fill('Nájem bytu')
  await page.getByRole('button', { name: 'Uložit změny' }).click()

  await expect(page.getByText('Další výskyt musí být dnes nebo v budoucnu.', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Konec nesmí být před dalším výskytem.', { exact: true })).toHaveCount(0)
  await expect.poll(() => rulesApi.rules()[0]?.name).toBe('Nájem bytu')
})

const endedRule = {
  id: 'rule-ended', name: 'Nájem', kind: 'transaction' as const, amountCzk: 18000,
  walletId: 'wallet-1', walletName: 'Běžný účet', categoryId: 'category-home', categoryName: 'Domov',
  categoryIconKey: 'house', categoryColorKey: 'orange', categoryDirection: 'expense' as const,
  sourceWalletId: null, sourceWalletName: null, destinationWalletId: null, destinationWalletName: null,
  note: 'Historická poznámka', labels: [{ id: 'label-1', name: 'bydlení' }], frequency: 'monthly' as const,
  customIntervalDays: null, nextOccurrenceDate: '2026-09-20', endsOn: '2026-08-20', status: 'ended' as const,
}
