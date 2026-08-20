import { apiRequest } from '../../lib/api-client'
import type { Transaction } from '../transactions/api'
import type { Transfer } from '../transfers/api'

export type FeedTransaction = Transaction & { kind: 'transaction' }
export type FeedTransfer = Transfer & { kind: 'transfer'; impactCzk: number }
export type FeedItem = FeedTransaction | FeedTransfer

export type FeedPage = {
  items: FeedItem[]
  nextCursor: string | null
}

export async function listFeed({ walletIds, dateFrom, dateTo, search, cursor, limit = 50, signal }: { walletIds?: string[]; dateFrom?: string; dateTo?: string; search?: string; cursor?: string; limit?: number; signal?: AbortSignal } = {}) {
  const query = new URLSearchParams({ limit: String(limit) })
  if (walletIds?.length) query.set('walletIds', walletIds.join(','))
  if (dateFrom) query.set('dateFrom', dateFrom)
  if (dateTo) query.set('dateTo', dateTo)
  if (search) query.set('search', search)
  if (cursor) query.set('cursor', cursor)
  return apiRequest<FeedPage>(`/feed?${query.toString()}`, { signal })
}
