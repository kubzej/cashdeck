import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockFeedApi } from '../support/feed'
import { mockPlannedApi } from '../support/planned'
import { mockWalletsApi } from '../support/wallets'

test('scopes the feed by the current month, selected visible wallets, period, and debounced search', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [
    { id: 'wallet-1', name: 'Běžný účet', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 0, isHidden: false, openingBalanceLocked: false },
    { id: 'wallet-2', name: 'Spoření', colorKey: 'blue', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 1, isHidden: false, openingBalanceLocked: false },
    { id: 'wallet-3', name: 'Archiv', colorKey: 'gray', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01', sortOrder: 2, isHidden: true, openingBalanceLocked: false },
  ])
  const feedApi = await mockFeedApi(page)
  const plannedApi = await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  await expect.poll(() => feedApi.requests().length).toBe(1)
  const initialRequest = feedApi.requests()[0]
  expect(initialRequest.searchParams.get('dateFrom')).toMatch(/^\d{4}-\d{2}-01$/)
  expect(initialRequest.searchParams.get('dateTo')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(initialRequest.searchParams.get('walletIds')).toBeNull()
  await expect.poll(() => plannedApi.requests().length).toBe(1)

  await page.getByRole('button', { name: 'Nastavit filtr účtů' }).click()
  await expect(page.getByRole('dialog')).not.toContainText('Archiv')
  await page.getByRole('dialog').getByRole('button', { name: 'Běžný účet', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Použít filtr' }).click()
  await expect.poll(() => feedApi.requests().length).toBe(2)
  expect(feedApi.requests()[1].searchParams.get('walletIds')).toBe('wallet-1')
  await expect.poll(() => plannedApi.requests().length).toBe(2)
  const plannedRequestCountBeforeHistory = plannedApi.requests().length

  await page.getByRole('button', { name: /^Nastavit zobrazené období:/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Celá historie', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Použít filtr' }).click()
  await expect.poll(() => feedApi.requests().length).toBe(3)
  const historyRequest = feedApi.requests()[2]
  expect(historyRequest.searchParams.get('dateFrom')).toBeNull()
  expect(historyRequest.searchParams.get('dateTo')).toBeNull()
  await expect.poll(() => plannedApi.requests().length).toBe(plannedRequestCountBeforeHistory)
  await expect(page.getByRole('button', { name: /Naplánované/ })).toHaveCount(0)

  await page.getByLabel('Hledat v transakcích').fill('slavia')
  await expect.poll(() => feedApi.requests().length).toBe(4)
  expect(feedApi.requests()[3].searchParams.get('search')).toBe('slavia')
})
