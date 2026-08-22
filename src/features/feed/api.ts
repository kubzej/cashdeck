import { apiRequest } from '../../lib/api-client'
import type { Transaction } from '../transactions/api'
import type { Transfer } from '../transfers/api'

export type FeedTransaction = Transaction & { kind: 'transaction'; recurringRuleName: string | null }
export type FeedTransfer = Transfer & { kind: 'transfer'; impactCzk: number; recurringRuleName: string | null }
export type FeedBalanceAdjustment = {
  kind: 'balance_adjustment'
  id: string
  walletId: string
  walletName: string
  amountCzk: number
  operation: 'add' | 'subtract'
  adjustmentDate: string
}
export type FeedItem = FeedTransaction | FeedTransfer | FeedBalanceAdjustment

export type FeedPage = {
  items: FeedItem[]
  nextCursor: string | null
}

export type FeedBounds = { earliestActivityDate: string | null }

export async function listFeed({ walletIds, dateFrom, dateTo, search, categoryId, labelId, cursor, limit = 50, signal }: { walletIds?: string[]; dateFrom?: string; dateTo?: string; search?: string; categoryId?: string; labelId?: string; cursor?: string; limit?: number; signal?: AbortSignal } = {}) {
  const query = new URLSearchParams({ limit: String(limit) })
  if (walletIds?.length) query.set('walletIds', walletIds.join(','))
  if (dateFrom) query.set('dateFrom', dateFrom)
  if (dateTo) query.set('dateTo', dateTo)
  if (search) query.set('search', search)
  if (categoryId) query.set('categoryId', categoryId)
  if (labelId) query.set('labelId', labelId)
  if (cursor) query.set('cursor', cursor)
  return apiRequest<FeedPage>(`/feed?${query.toString()}`, { signal })
}

export async function getFeedBounds({ walletIds, categoryId, labelId, signal }: { walletIds?: string[]; categoryId?: string; labelId?: string; signal?: AbortSignal } = {}) {
  const query = new URLSearchParams()
  if (walletIds?.length) query.set('walletIds', walletIds.join(','))
  if (categoryId) query.set('categoryId', categoryId)
  if (labelId) query.set('labelId', labelId)
  const suffix = query.size ? `?${query.toString()}` : ''
  return apiRequest<FeedBounds>(`/feed/bounds${suffix}`, { signal })
}
