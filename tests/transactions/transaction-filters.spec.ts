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

  await page.getByRole('button', { name: 'Nastavit filtr peněženek' }).click()
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

test('hides Naplánované while a search filter is active, and brings it back once the search is cleared', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockFeedApi(page)
  const plannedApi = await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  await expect.poll(() => plannedApi.requests().length).toBeGreaterThan(0)
  const plannedCountBeforeSearch = plannedApi.requests().length

  await page.getByLabel('Hledat v transakcích').fill('slavia')
  // Naplánované is about upcoming activity in general — once search narrows the view to one
  // slice, it's a distraction pointing at unrelated data.
  await page.waitForTimeout(300)
  expect(plannedApi.requests()).toHaveLength(plannedCountBeforeSearch)

  await page.getByLabel('Hledat v transakcích').fill('')
  await expect.poll(() => plannedApi.requests().length).toBeGreaterThan(plannedCountBeforeSearch)
})

test('an empty list says what is hiding the rest: filters, only the period, or nothing at all', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockFeedApi(page, [])
  await page.goto('/')
  await signIn(page)

  // Only the (default) period narrows the list: a month with nothing in it is not "no transactions".
  await expect(page.getByText('V tomto období nic není', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zrušit filtry' })).toHaveCount(0)

  // A search that matches nothing is not "no transactions" either, and can be cleared from here.
  await page.getByLabel('Hledat v transakcích').fill('nic takového')
  await expect(page.getByText('Nic neodpovídá filtrům', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zrušit filtry' }).click()
  await expect(page.getByLabel('Hledat v transakcích')).toHaveValue('')
  await expect(page.getByText('V tomto období nic není', { exact: true })).toBeVisible()

  // Only with the whole history and no filter does "nothing yet" become true.
  await page.getByRole('button', { name: /^Nastavit zobrazené období:/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Celá historie', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Použít filtr' }).click()
  await expect(page.getByText('Zatím bez transakcí', { exact: true })).toBeVisible()
  await expect(page.getByText('Přidej první příjem nebo výdaj.', { exact: true })).toBeVisible()
})

test('period pager arrows are at least 44px touch targets', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  const arrows = page.locator('.feed-period-pager__nav')
  await expect(arrows).toHaveCount(2)
  for (const arrow of await arrows.all()) {
    const box = await arrow.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
})

test('week and year periods request their own date range, anchored on today', async ({ page }) => {
  await mockAuthAndApi(page)
  const feedApi = await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)
  await expect.poll(() => feedApi.requests().length).toBe(1)

  await page.getByRole('button', { name: /^Nastavit zobrazené období:/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Týden', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Použít filtr' }).click()
  await expect.poll(() => feedApi.requests().length).toBe(2)
  const week = feedApi.requests()[1]
  // 21 Aug 2026 is a Friday: the week runs Monday to Sunday around it.
  expect([week.searchParams.get('dateFrom'), week.searchParams.get('dateTo')]).toEqual(['2026-08-17', '2026-08-23'])

  await page.getByRole('button', { name: /^Nastavit zobrazené období:/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Rok', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Použít filtr' }).click()
  await expect.poll(() => feedApi.requests().length).toBe(3)
  const year = feedApi.requests()[2]
  expect([year.searchParams.get('dateFrom'), year.searchParams.get('dateTo')]).toEqual(['2026-01-01', '2026-12-31'])
})
