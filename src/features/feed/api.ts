import { apiRequest } from '../../lib/api-client'
import type { Transaction } from '../transactions/api'
import type { Transfer } from '../transfers/api'

export type FeedTransaction = Transaction & { kind: 'transaction' }
export type FeedTransfer = Transfer & { kind: 'transfer' }
export type FeedItem = FeedTransaction | FeedTransfer

export type FeedPage = {
  items: FeedItem[]
  nextCursor: string | null
}

export async function listFeed({ walletId, dateFrom, dateTo, cursor, limit = 50 }: { walletId?: string; dateFrom?: string; dateTo?: string; cursor?: string; limit?: number } = {}) {
  const search = new URLSearchParams({ limit: String(limit) })
  if (walletId) search.set('walletId', walletId)
  if (dateFrom) search.set('dateFrom', dateFrom)
  if (dateTo) search.set('dateTo', dateTo)
  if (cursor) search.set('cursor', cursor)
  return apiRequest<FeedPage>(`/feed?${search.toString()}`)
}
