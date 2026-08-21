import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockRecurringRulesApi } from '../support/recurring'
import { mockWalletsApi } from '../support/wallets'

test('shows the error state and recovers after retrying a failed recurring rules load', async ({ page }) => {
  await mockAuthAndApi(page)
  const recurringApi = await mockRecurringRulesApi(page, [])
  recurringApi.failNext('GET', { message: 'Dočasně nedostupné.' })
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: /Opakování/ }).click()

  await expect(page.getByText('Opakování se nepodařilo načíst', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zkusit znovu' }).click()

  await expect(page.getByText('Bez opakování', { exact: true })).toBeVisible()
})

test('shows the source/destination wallet directly on each rule\'s card', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, wallets)
  await mockRecurringRulesApi(page, [transactionRule, transferRule])
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: /Opakování/ }).click()

  await expect(page.getByRole('listitem').filter({ hasText: 'Nájem' })).toContainText('v Běžný účet')
  await expect(page.getByRole('listitem').filter({ hasText: 'Spoření' })).toContainText('z Běžný účet do Rezerva')
})

test('reorders recurring rules with the drag handle and saves the new order', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, wallets)
  const recurringApi = await mockRecurringRulesApi(page, [transactionRule, transferRule])
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: /Opakování/ }).click()

  const source = page.getByRole('button', { name: 'Změnit pořadí opakování Nájem' })
  const target = page.getByRole('button', { name: 'Změnit pořadí opakování Spoření' })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Drag handle opakování není viditelný.')

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 + 12, { steps: 4 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
  await page.mouse.up()

  await expect(page.getByRole('listitem').first()).toContainText('Spoření')
  await expect.poll(() => recurringApi.rules().map((rule) => rule.id)).toEqual(['rule-transfer', 'rule-transaction'])

  await page.reload()
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: /Opakování/ }).click()
  await expect(page.getByRole('listitem').first()).toContainText('Spoření')
  await expect(page.getByRole('listitem').nth(1)).toContainText('Nájem')
})

const wallets = [
  { id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false },
  { id: 'wallet-2', name: 'Rezerva', colorKey: 'blue', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 1, isHidden: false, openingBalanceLocked: false },
]

const transactionRule = {
  id: 'rule-transaction', name: 'Nájem', kind: 'transaction' as const, amountCzk: 18000,
  walletId: wallets[0].id, walletName: wallets[0].name, categoryId: 'category-home', categoryName: 'Domov',
  categoryIconKey: 'house', categoryColorKey: 'orange', categoryDirection: 'expense' as const,
  sourceWalletId: null, sourceWalletName: null, destinationWalletId: null, destinationWalletName: null,
  note: null, labels: [], frequency: 'monthly' as const,
  customIntervalDays: null, nextOccurrenceDate: '2099-08-18', endsOn: null, status: 'active' as const,
  sortOrder: 0,
}

const transferRule = {
  id: 'rule-transfer', name: 'Spoření', kind: 'transfer' as const, amountCzk: 5000,
  walletId: null, walletName: null, categoryId: null, categoryName: null,
  categoryIconKey: null, categoryColorKey: null, categoryDirection: null,
  sourceWalletId: wallets[0].id, sourceWalletName: wallets[0].name, destinationWalletId: wallets[1].id, destinationWalletName: wallets[1].name,
  note: null, labels: [], frequency: 'monthly' as const,
  customIntervalDays: null, nextOccurrenceDate: '2099-08-18', endsOn: null, status: 'active' as const,
  sortOrder: 1,
}
