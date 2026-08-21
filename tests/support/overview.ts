import { expect, type Page } from '@playwright/test'
import type { OverviewMetrics, OverviewSelectionTrend } from '../../src/features/overview/api'

export const overviewFixture: OverviewMetrics = {
  range: { dateFrom: '2026-08-01', dateTo: '2026-08-21', earliestActivityDate: '2025-01-01', granularity: 'day' },
  wealth: { amountCzk: 428_600, changeCzk: 21_400 },
  flow: { incomeCzk: 74_500, expenseCzk: 53_100, cashflowCzk: 21_400 },
  wealthSeries: [
    { date: '2026-08-01', valueCzk: 407_200 },
    { date: '2026-08-08', valueCzk: 409_600 },
    { date: '2026-08-15', valueCzk: 418_900 },
    { date: '2026-08-21', valueCzk: 428_600 },
  ],
  flowSeries: [
    { date: '2026-08-01', incomeCzk: 0, expenseCzk: 1_250 },
    { date: '2026-08-07', incomeCzk: 52_000, expenseCzk: 11_600 },
    { date: '2026-08-15', incomeCzk: 22_500, expenseCzk: 18_900 },
    { date: '2026-08-21', incomeCzk: 0, expenseCzk: 21_350 },
  ],
  categories: [
    { id: 'c00f7a6a-d0c1-4f08-9bd4-643415bef121', name: 'Bydlení', iconKey: 'house', colorKey: 'brown', direction: 'expense', amountCzk: 18_500, transactionCount: 2 },
    { id: 'c00f7a6a-d0c1-4f08-9bd4-643415bef122', name: 'Restaurace', iconKey: 'utensils', colorKey: 'orange', direction: 'expense', amountCzk: 5_400, transactionCount: 8 },
    { id: 'c00f7a6a-d0c1-4f08-9bd4-643415bef123', name: 'Výplata', iconKey: 'banknote-arrow-up', colorKey: 'green', direction: 'income', amountCzk: 52_000, transactionCount: 1 },
  ],
  labels: [
    { id: 'c00f7a6a-d0c1-4f08-9bd4-643415bef124', name: 'domácnost', incomeCzk: 0, expenseCzk: 19_240, transactionCount: 4, transferImpactCzk: 0, transferCount: 0 },
    { id: 'c00f7a6a-d0c1-4f08-9bd4-643415bef125', name: 'freelance', incomeCzk: 22_500, expenseCzk: 0, transactionCount: 2, transferImpactCzk: 0, transferCount: 0 },
  ],
}

export const overviewSelectionTrendFixture: OverviewSelectionTrend = {
  previous: { amountCzk: -21_000 },
  series: [
    { date: '2026-06-01', amountCzk: -15_000 },
    { date: '2026-07-01', amountCzk: -21_000 },
    { date: '2026-08-01', amountCzk: -18_500 },
  ],
}

export type OverviewApiMock = {
  requests: () => URL[]
  selectionRequests: () => URL[]
  failNext: (failure?: { status?: number; message?: string; target?: 'overview' | 'selection' }) => void
}

export async function mockOverviewApi(page: Page, fixture: OverviewMetrics = overviewFixture, selectionTrend: OverviewSelectionTrend = overviewSelectionTrendFixture) {
  const requests: URL[] = []
  const selectionRequests: URL[] = []
  let queuedFailure: { status: number; message: string; target: 'overview' | 'selection' } | null = null

  await page.route('http://api.test/api/overview**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer token-1')
    const url = new URL(route.request().url())
    const isSelection = url.pathname === '/api/overview/selection'
    if (queuedFailure && queuedFailure.target === (isSelection ? 'selection' : 'overview')) {
      const failure = queuedFailure
      queuedFailure = null
      await route.fulfill({ contentType: 'application/json', status: failure.status, body: JSON.stringify({ message: failure.message }) })
      return
    }
    if (isSelection) {
      selectionRequests.push(url)
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(selectionTrend) })
      return
    }
    requests.push(url)
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) })
  })

  return {
    requests: () => requests,
    selectionRequests: () => selectionRequests,
    failNext(failure = {}) {
      queuedFailure = { status: failure.status ?? 500, message: failure.message ?? 'Dočasně nedostupné.', target: failure.target ?? 'overview' }
    },
  } satisfies OverviewApiMock
}
