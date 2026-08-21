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
