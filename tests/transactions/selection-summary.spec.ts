import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockFeedApi } from '../support/feed'
import { mockPlannedApi } from '../support/planned'
import { mockOverviewApi, overviewFixture, overviewSelectionTrendFixture } from '../support/overview'

test('renders a bar per bucket in the selection trend chart', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockOverviewApi(page)
  await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()
  await page.getByRole('button', { name: /Bydlení/ }).click()

  const sparkline = page.locator('.selection-summary__sparkline')
  await expect(sparkline).toBeVisible()
  await expect(sparkline.locator('i')).toHaveCount(overviewSelectionTrendFixture.series.length)
})

test('gives a zero-activity bucket a visibly shorter bar than an active one', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockOverviewApi(page, overviewFixture, {
    previous: { amountCzk: -5_000 },
    series: [
      { date: '2026-06-01', amountCzk: 0 },
      { date: '2026-07-01', amountCzk: -20_000 },
    ],
  })
  await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()
  await page.getByRole('button', { name: /Bydlení/ }).click()

  const bars = page.locator('.selection-summary__sparkline i')
  await expect(bars).toHaveCount(2)
  const [zeroBar, activeBar] = await Promise.all([bars.nth(0).boundingBox(), bars.nth(1).boundingBox()])
  if (!zeroBar || !activeBar) throw new Error('Sparkline bar není viditelný.')
  expect(activeBar.height).toBeGreaterThan(zeroBar.height * 2)
})

test('shows a tooltip with the bucket amount when a sparkline bar is tapped, and hides it on a second tap', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockOverviewApi(page)
  await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()
  await page.getByRole('button', { name: /Bydlení/ }).click()

  const tooltip = page.locator('.selection-summary__sparkline-tooltip')
  await expect(tooltip).toHaveCount(0)

  const bars = page.locator('.selection-summary__sparkline button')
  await bars.last().click()
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('-18 500 Kč')

  // Tapping the most recent (rightmost) bar is the common case — the tooltip is centered on it,
  // so without a clamp it would overflow the card's right edge and the page horizontally, which
  // is exactly what triggered the fixed bottom nav visibly jumping on a real device.
  const tooltipBox = await tooltip.boundingBox()
  const cardBox = await page.locator('.selection-summary').boundingBox()
  if (!tooltipBox || !cardBox) throw new Error('Tooltip nebo karta není viditelná.')
  expect(tooltipBox.x).toBeGreaterThanOrEqual(cardBox.x - 1)
  expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1)

  await bars.last().click()
  await expect(tooltip).toHaveCount(0)
})

test('shows a negative trend pill when spending increased over the previous period', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockOverviewApi(page, overviewFixture, { previous: { amountCzk: -5_000 }, series: [] })
  await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()
  await page.getByRole('button', { name: /Bydlení/ }).click()

  // Bydlení spent -18 500 Kč this period vs -5 000 Kč the previous one: spending grew, which is
  // unfavorable for an expense category even though the raw amount became more negative.
  const trend = page.locator('.selection-summary__trend')
  await expect(trend).toHaveClass(/selection-summary__trend--negative/)
  await expect(trend).toContainText('270 %')
})

test('shows a neutral fallback instead of echoing the amount when there is no previous period to compare', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockOverviewApi(page, overviewFixture, { previous: { amountCzk: 0 }, series: [] })
  await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()
  await page.getByRole('button', { name: /Bydlení/ }).click()

  const trend = page.locator('.selection-summary__trend')
  await expect(trend).toHaveText('bez srovnání')
  await expect(trend).not.toContainText('18 500')
  await expect(trend).not.toHaveClass(/selection-summary__trend--(positive|negative)/)
})

test('still shows the headline amount when the trend and chart fail to load', async ({ page }) => {
  await mockAuthAndApi(page)
  const overviewApi = await mockOverviewApi(page)
  await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()
  overviewApi.failNext({ target: 'selection', message: 'Trend se nepodařilo načíst.' })
  await page.getByRole('button', { name: /Bydlení/ }).click()

  const summary = page.locator('.selection-summary')
  await expect(summary).toContainText('-18 500 Kč')
  await expect(summary.locator('.selection-summary__trend')).toHaveCount(0)
  await expect(summary.locator('.selection-summary__sparkline')).toHaveCount(0)
})

test('shows a "Celkem" summary with the same trend pill and graph a category/label selection gets — not a lesser version of the card', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockOverviewApi(page)
  await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  const summary = page.locator('.selection-summary')
  await expect(summary).toContainText('Celkem')
  await expect(summary).toContainText('21 400 Kč')
  // Same meta format as a category/label selection — a transaction count, not an income/expense
  // breakdown. overviewFixture's categories sum to 2 + 8 + 1 = 11 transactions.
  await expect(summary.locator('.selection-summary__meta')).toContainText('11 transakcí')
  // No redundant second title next to the "Celkem" kicker — unlike a category/label selection,
  // there's no more specific name to show alongside it.
  await expect(summary.locator('.selection-summary__name')).toHaveCount(0)
  // 21 400 Kč this period vs -21 000 Kč (overviewSelectionTrendFixture.previous) the last one.
  await expect(summary.locator('.selection-summary__trend')).toHaveClass(/selection-summary__trend--positive/)
  await expect(summary.locator('.selection-summary__sparkline i')).toHaveCount(overviewSelectionTrendFixture.series.length)
})

test('debounces search typing into a single request, and settles the summary card and the transaction list on the exact same search text', async ({ page }) => {
  await mockAuthAndApi(page)
  const overviewApi = await mockOverviewApi(page)
  const feedApi = await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  await expect.poll(() => overviewApi.requests().length).toBe(1)
  const overviewCountBeforeTyping = overviewApi.requests().length
  const feedCountBeforeTyping = feedApi.requests().length

  await page.getByLabel('Hledat v transakcích').pressSequentially('Oneplay', { delay: 20 })

  // Every keystroke resets the debounce timer — 7 characters at 20ms apart (~140ms) never clears
  // the 250ms window, so this must collapse into exactly one request, not one per keystroke.
  await expect.poll(() => overviewApi.requests().length).toBe(overviewCountBeforeTyping + 1)
  expect(overviewApi.requests().at(-1)?.searchParams.get('search')).toBe('Oneplay')
  await expect.poll(() => feedApi.requests().length).toBe(feedCountBeforeTyping + 1)
  expect(feedApi.requests().at(-1)?.searchParams.get('search')).toBe('Oneplay')

  // With no category/label picked, search itself becomes the shown selection — same "type of
  // filter, plus its value" shape as Kategorie/Štítek, not a separate "Celkem" look.
  const summary = page.locator('.selection-summary')
  await expect(summary).toContainText('Vyhledávání')
  await expect(summary.locator('.selection-summary__name')).toContainText('Oneplay')
  await expect(summary).not.toContainText('Celkem')
})

test('clearing the search text reverts the summary card to the full unfiltered total', async ({ page }) => {
  await mockAuthAndApi(page)
  const overviewApi = await mockOverviewApi(page)
  await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  await page.getByLabel('Hledat v transakcích').fill('Oneplay')
  await expect.poll(() => overviewApi.requests().at(-1)?.searchParams.get('search')).toBe('Oneplay')
  await expect(page.locator('.selection-summary')).toContainText('Vyhledávání')

  await page.getByLabel('Hledat v transakcích').fill('')
  await expect.poll(() => overviewApi.requests().at(-1)?.searchParams.get('search')).toBeNull()
  const summary = page.locator('.selection-summary')
  await expect(summary).toContainText('Celkem')
  await expect(summary).not.toContainText('Vyhledávání')
  await expect(summary).toContainText('21 400 Kč')
  // Same meta format as a category/label selection — a transaction count, not an income/expense
  // breakdown. overviewFixture's categories sum to 2 + 8 + 1 = 11 transactions.
  await expect(summary.locator('.selection-summary__meta')).toContainText('11 transakcí')
})

test('combining a category selection with search text sends the search to both the headline and the trend request, keeping them consistent', async ({ page }) => {
  await mockAuthAndApi(page)
  const overviewApi = await mockOverviewApi(page)
  await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()
  await page.getByRole('button', { name: /Bydlení/ }).click()
  await expect(page.locator('.selection-summary')).toContainText('Bydlení')

  const overviewCountBeforeSearch = overviewApi.requests().length
  const selectionCountBeforeSearch = overviewApi.selectionRequests().length

  await page.getByLabel('Hledat v transakcích').fill('nájem')

  await expect.poll(() => overviewApi.requests().length).toBe(overviewCountBeforeSearch + 1)
  await expect.poll(() => overviewApi.selectionRequests().length).toBe(selectionCountBeforeSearch + 1)
  expect(overviewApi.requests().at(-1)?.searchParams.get('search')).toBe('nájem')
  expect(overviewApi.selectionRequests().at(-1)?.searchParams.get('search')).toBe('nájem')
})

test('a stale in-flight overview response for an old search never overwrites a newer search\'s result', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockFeedApi(page)
  await mockPlannedApi(page, [])

  await page.route('http://api.test/api/overview**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/overview/selection') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(overviewSelectionTrendFixture) })
      return
    }
    const search = url.searchParams.get('search')
    if (search === 'pomalu') {
      // Simulates a slow response for the first search landing after a second, faster one — the
      // component must not let it clobber the newer (cleared-search) result once it finally lands.
      await new Promise((resolve) => setTimeout(resolve, 600))
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...overviewFixture, flow: { incomeCzk: 1, expenseCzk: 0, cashflowCzk: 1 } }) })
      return
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(overviewFixture) })
  })

  await page.goto('/')
  await signIn(page)

  await page.getByLabel('Hledat v transakcích').fill('pomalu')
  await page.waitForTimeout(300)
  await page.getByLabel('Hledat v transakcích').fill('')

  const summary = page.locator('.selection-summary')
  await expect(summary).toContainText('21 400 Kč')
  // Give the stale 'pomalu' response (600ms server delay, ~850ms after it was requested) time to
  // land — if it were not ignored, it would overwrite the total and stay there permanently.
  await page.waitForTimeout(600)
  await expect(summary).toContainText('21 400 Kč')
  await expect(summary).not.toContainText('1 Kč')
})
