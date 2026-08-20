import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockCategoriesApi } from '../support/categories'
import { mockLabelsApi } from '../support/labels'
import { mockRecurringRulesApi, type RecurringRulesApiMock } from '../support/recurring'
import { mockTransactionsApi } from '../support/transactions'
import { mockTransfersApi } from '../support/transfers'
import { mockWalletsApi } from '../support/wallets'

test('edits a recurring rule and retries a failed update', async ({ page }) => {
  const recurringApi = await openRuleEditor(page)

  await expect(page.getByLabel('Název')).toHaveValue('Nájem')
  await expect(page.getByRole('textbox', { name: 'Částka', exact: true })).toHaveValue('18000')
  await expect(page.getByLabel('Poznámka')).toHaveValue('Původní poznámka')
  await page.getByLabel('Název').fill('Nájem po úpravě')
  await page.getByRole('textbox', { name: 'Částka', exact: true }).fill('19500')
  await page.getByRole('button', { name: 'Domov' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Předplatné', exact: true }).click()
  await page.getByLabel('Poznámka').fill('Nová poznámka')

  recurringApi.failNext('PATCH', { message: 'Změny jsou dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect(page.getByText('Opakování se nepodařilo uložit', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect.poll(() => recurringApi.rules()[0]).toMatchObject({
    name: 'Nájem po úpravě', amountCzk: 19500, categoryId: 'category-subscription', note: 'Nová poznámka', status: 'active',
  })
  await expect(page.getByText('Nájem po úpravě', { exact: true })).toBeVisible()
})

test('cancels, retries, and completes recurring rule deletion', async ({ page }) => {
  const recurringApi = await openRuleEditor(page)

  await page.getByRole('button', { name: 'Smazat opakování' }).click()
  await page.getByRole('button', { name: 'Zrušit' }).click()
  await expect(page.getByRole('heading', { name: 'Upravit opakování' })).toBeVisible()

  recurringApi.failNext('DELETE', { message: 'Smazání je dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Smazat opakování' }).click()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await expect(page.getByText('Opakování se nepodařilo smazat', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Zrušit' }).click()
  await page.getByRole('button', { name: 'Smazat opakování' }).click()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await expect.poll(() => recurringApi.rules()).toEqual([])
  await expect(page.getByText('Bez opakování', { exact: true })).toBeVisible()
})

const wallets = [
  { id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false },
]

async function openRuleEditor(page: Parameters<typeof mockAuthAndApi>[0]): Promise<RecurringRulesApiMock> {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, wallets)
  await mockCategoriesApi(page, [
    { id: 'category-home', name: 'Domov', direction: 'expense', iconKey: 'house', colorKey: 'orange', sortOrder: 0 },
    { id: 'category-subscription', name: 'Předplatné', direction: 'expense', iconKey: 'repeat-2', colorKey: 'purple', sortOrder: 1 },
  ])
  await mockLabelsApi(page, [{ id: 'label-1', name: 'bydlení' }])
  await mockTransactionsApi(page)
  await mockTransfersApi(page)
  const recurringApi = await mockRecurringRulesApi(page, [rule])
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: /Opakování/ }).click()
  await page.getByRole('button', { name: /Nájem/ }).click()
  return recurringApi
}

const rule = {
  id: 'rule-1', name: 'Nájem', kind: 'transaction' as const, amountCzk: 18000,
  walletId: wallets[0].id, walletName: wallets[0].name, categoryId: 'category-home', categoryName: 'Domov',
  categoryIconKey: 'house', categoryColorKey: 'orange', categoryDirection: 'expense' as const,
  sourceWalletId: null, sourceWalletName: null, destinationWalletId: null, destinationWalletName: null,
  note: 'Původní poznámka', labels: [{ id: 'label-1', name: 'bydlení' }], frequency: 'monthly' as const,
  customIntervalDays: null, nextOccurrenceDate: '2026-09-20', endsOn: '2026-12-20', status: 'active' as const,
}
