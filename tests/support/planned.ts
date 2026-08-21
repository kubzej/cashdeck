import { expect, type Page } from '@playwright/test'
import type { PlannedItem, PlannedResult } from '../../src/features/planned/api'

export type PlannedApiMock = {
  requests: () => URL[]
}

export async function mockPlannedApi(page: Page, items: PlannedItem[]) {
  const requests: string[] = []

  await page.route('http://api.test/api/planned**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer token-1')
    requests.push(route.request().url())
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items, summary: summarize(items) } satisfies PlannedResult),
    })
  })

  return { requests: () => requests.map((request) => new URL(request)) } satisfies PlannedApiMock
}

function summarize(items: PlannedItem[]) {
  return {
    count: items.length,
    totalCzk: items.reduce((total, item) => total + getItemImpact(item), 0),
  }
}

function getItemImpact(item: PlannedItem) {
  if (item.kind === 'transaction') return item.direction === 'income' ? item.amountCzk : -item.amountCzk
  return item.impactCzk
}
