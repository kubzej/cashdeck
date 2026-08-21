import { expect, type Page } from '@playwright/test'
import type { FeedItem } from '../../src/features/feed/api'
import type { Transaction } from '../../src/features/transactions/api'
import type { Transfer } from '../../src/features/transfers/api'

type FeedSource = FeedItem[] | (() => FeedItem[])

export type FeedApiMock = {
  requests: () => URL[]
  boundsRequests: () => URL[]
}

export async function mockFeedApi(page: Page, source: FeedSource = [], { earliestActivityDate }: { earliestActivityDate?: string | null } = {}) {
  const getItems = typeof source === 'function' ? source : () => source
  const requests: string[] = []
  const boundsRequests: string[] = []

  await page.route('http://api.test/api/feed**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer token-1')
    const url = new URL(route.request().url())
    if (url.pathname === '/api/feed/bounds') {
      boundsRequests.push(url.toString())
      const items = getItems()
      const firstActivityDate = items.map(activityDate).sort().at(0) ?? null
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ earliestActivityDate: earliestActivityDate ?? firstActivityDate }) })
      return
    }
    requests.push(url.toString())
    const limit = Number(url.searchParams.get('limit') ?? '50')
    const start = Number(url.searchParams.get('cursor')?.replace('cursor-', '') ?? '0')
    const items = getItems()
    const pageItems = items.slice(start, start + limit)
    const nextCursor = start + limit < items.length ? `cursor-${start + limit}` : null
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: pageItems, nextCursor }) })
  })

  return { requests: () => requests.map((request) => new URL(request)), boundsRequests: () => boundsRequests.map((request) => new URL(request)) } satisfies FeedApiMock
}

export function feedItems(transactions: Transaction[] = [], transfers: Transfer[] = []): FeedItem[] {
  return [
    ...transactions.map((transaction) => ({ kind: 'transaction' as const, ...transaction })),
    ...transfers.map((transfer) => ({ kind: 'transfer' as const, ...transfer, impactCzk: 0 })),
  ].sort((left, right) => activityDate(right).localeCompare(activityDate(left)))
}

function activityDate(item: FeedItem) {
  return item.kind === 'transaction' ? item.transactionDate : item.kind === 'transfer' ? item.transferDate : item.adjustmentDate
}
