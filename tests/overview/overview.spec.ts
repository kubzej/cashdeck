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

test('opens an exact category filter in the transaction list', async ({ page }) => {
  await openSignedInApp(page)
  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()
  await page.getByRole('button', { name: /Bydlení/ }).click()

  await expect(page.getByRole('heading', { name: 'Transakce', exact: true })).toBeVisible()
  await expect(page.getByText('Kategorie:')).toBeVisible()
  await expect(page.getByText('Bydlení', { exact: true })).toBeVisible()
  await expect(page.getByText('Zatím bez transakcí', { exact: true })).toBeVisible()
})

test('keeps an overview label filter exact in both actual and planned activity', async ({ page }) => {
  await mockAuthAndApi(page)
  const feedApi = await mockFeedApi(page)
  const plannedApi = await mockPlannedApi(page, [])
  await page.goto('/')
  await signIn(page)

  await page.locator('.bottom-nav').getByRole('button', { name: 'Přehled', exact: true }).click()
  await page.getByRole('button', { name: /domácnost/ }).click()

  const labelId = overviewFixture.labels[0].id
  await expect(page.locator('.transaction-fixed-selection')).toContainText('Štítek:')
  await expect.poll(() => feedApi.requests().some((request) => request.searchParams.get('labelId') === labelId)).toBe(true)
  await expect.poll(() => feedApi.boundsRequests().some((request) => request.searchParams.get('labelId') === labelId)).toBe(true)
  await expect.poll(() => plannedApi.requests().some((request) => request.searchParams.get('labelId') === labelId)).toBe(true)
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
