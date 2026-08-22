import { expect, test } from '@playwright/test'
import { mockAuthAndApi, openSignedInApp, signIn } from '../support/auth'
import { mockFeedApi } from '../support/feed'
import { mockPlannedApi } from '../support/planned'
import { mockOverviewApi, overviewFixture } from '../support/overview'

test('shows server-aggregated wealth, cashflow and breakdowns', async ({ page }) => {
  await openSignedInApp(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()

  await expect(page.getByText('Celkové bohatství', { exact: true })).toBeVisible()
  await expect(page.getByText('428 600 Kč', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Vývoj bohatství', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kategorie', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Štítky', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Cashflow', exact: true }).click()
  await expect(page.getByText('Cashflow v období', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Graf peněžního toku')).toBeVisible()
})

test('shows expenses with a minus sign, not a plus, even though the stored amount is a positive magnitude', async ({ page }) => {
  await openSignedInApp(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()

  await page.getByRole('button', { name: 'Příjmy', exact: true }).click()
  await expect(page.getByText('+74 500 Kč', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Výdaje', exact: true }).click()
  await expect(page.getByText('-53 100 Kč', { exact: true })).toBeVisible()
  await expect(page.getByText('+53 100 Kč', { exact: true })).toHaveCount(0)
})

test('excludes transfer impact from a label\'s total, even in Celkem mode', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockOverviewApi(page, {
    ...overviewFixture,
    labels: [
      { id: 'label-with-transfers', name: 'rezerva', incomeCzk: 10_000, expenseCzk: 4_000, transactionCount: 3, transferImpactCzk: 50_000, transferCount: 2 },
    ],
  })
  await mockFeedApi(page)
  await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()

  const row = page.getByRole('button', { name: /rezerva/ })
  await expect(row).toContainText('+6 000 Kč')
  await expect(row).not.toContainText('56 000 Kč')
})

test('shows the error state and recovers after retrying a failed overview load', async ({ page }) => {
  await mockAuthAndApi(page)
  const overviewApi = await mockOverviewApi(page)
  await page.goto('/')
  await signIn(page)
  // Transakce (the landing screen) already fired its own /api/overview request for the totals
  // card — wait for it to settle before queuing the failure, so it lands on Přehled's own load
  // instead of being consumed by that earlier request.
  await expect.poll(() => overviewApi.requests().length).toBe(1)
  overviewApi.failNext({ message: 'Dočasně nedostupné.' })
  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()

  await expect(page.getByText('Přehled se nepodařilo načíst', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zkusit znovu' }).click()

  await expect(page.getByText('Celkové bohatství', { exact: true })).toBeVisible()
})

test('opens an exact category filter in the transaction list', async ({ page }) => {
  await openSignedInApp(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()
  await page.getByRole('button', { name: /Bydlení/ }).click()

  await expect(page.getByRole('heading', { name: 'Transakce', exact: true })).toBeVisible()
  const summary = page.locator('.selection-summary')
  await expect(summary).toContainText('Kategorie')
  await expect(summary).toContainText('Bydlení')
  await expect(summary).toContainText('-18 500 Kč')
  await expect(summary).toContainText('2 transakce')
  await expect(summary).toContainText('12 %')
  await expect(page.getByText('Zatím bez transakcí', { exact: true })).toBeVisible()
})

test('keeps an overview label filter exact in both actual and planned activity, then resets it completely', async ({ page }) => {
  await mockAuthAndApi(page)
  const feedApi = await mockFeedApi(page)
  const plannedApi = await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  // Landing on Transakce fires its own (unfiltered) Naplánované request before the label filter
  // is ever applied — count from here on, not from an absolute zero.
  await expect.poll(() => plannedApi.requests().length).toBeGreaterThan(0)
  const plannedCountBeforeFilter = plannedApi.requests().length

  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()
  await page.getByRole('button', { name: /domácnost/ }).click()

  const labelId = overviewFixture.labels[0].id
  await expect(page.locator('.selection-summary')).toContainText('Štítek')
  await expect(page.locator('.selection-summary')).toContainText('domácnost')
  await expect(page.locator('.selection-summary')).toContainText('-19 240 Kč')
  await expect.poll(() => feedApi.requests().some((request) => request.searchParams.get('labelId') === labelId)).toBe(true)
  await expect.poll(() => feedApi.boundsRequests().some((request) => request.searchParams.get('labelId') === labelId)).toBe(true)
  // Naplánované is about upcoming activity in general — while a label filter narrows the view,
  // it would just point at unrelated data, so it's hidden entirely (no new request) rather than
  // narrowed to the label like the transaction list is.
  await page.waitForTimeout(300)
  expect(plannedApi.requests()).toHaveLength(plannedCountBeforeFilter)

  await page.getByRole('button', { name: 'Zrušit všechny filtry' }).click()
  // Clearing the filter brings Naplánované back.
  await expect.poll(() => plannedApi.requests().length).toBeGreaterThan(plannedCountBeforeFilter)

  // The summary card itself stays — it now always shows a running total for the active filters —
  // but it must drop the label-specific framing along with the label filter.
  const clearedSummary = page.locator('.selection-summary')
  await expect(clearedSummary).toContainText('Celkem')
  await expect(clearedSummary).not.toContainText('Štítek')
  await expect(clearedSummary).not.toContainText('domácnost')
  await expect(page.getByRole('button', { name: 'Zrušit všechny filtry' })).toHaveCount(0)
  await expect.poll(() => feedApi.requests().at(-1)?.searchParams.get('labelId')).toBeNull()
  await expect.poll(() => feedApi.boundsRequests().at(-1)?.searchParams.get('labelId')).toBeNull()
  await expect.poll(() => plannedApi.requests().at(-1)?.searchParams.get('labelId')).toBeNull()
})

test('uses actual wealth terminology and keeps edge tooltips inside the flow chart', async ({ page }) => {
  await openSignedInApp(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()

  await expect(page.getByText('Odhadované bohatství', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cashflow', exact: true }).click()
  const chart = page.getByLabel('Graf peněžního toku')
  const bars = chart.locator('.overview-flow-chart__columns > button')
  const chartBox = await chart.boundingBox()
  if (!chartBox) throw new Error('Flow chart is not visible')

  await bars.first().click()
  const tooltip = chart.locator('.overview-flow-chart__tooltip')
  const firstTooltipBox = await tooltip.boundingBox()
  if (!firstTooltipBox) throw new Error('First tooltip is not visible')
  expect(firstTooltipBox.x).toBeGreaterThanOrEqual(chartBox.x)

  await bars.last().click()
  const lastTooltipBox = await tooltip.boundingBox()
  if (!lastTooltipBox) throw new Error('Last tooltip is not visible')
  expect(lastTooltipBox.x + lastTooltipBox.width).toBeLessThanOrEqual(chartBox.x + chartBox.width)
})
