import { apiRequest } from '../../lib/api-client'
import type { CategoryColorKey, CategoryIconKey } from '../categories/api'
import type { CategoryDirection, FeedPeriod, OverviewGranularity, OverviewSelectionType } from '../../../server/src/catalog'

export type { OverviewGranularity, OverviewSelectionType }
export type OverviewCategory = { id: string; name: string; iconKey: CategoryIconKey; colorKey: CategoryColorKey; direction: CategoryDirection; amountCzk: number; transactionCount: number }
export type OverviewLabel = { id: string; name: string; incomeCzk: number; expenseCzk: number; transactionCount: number; transferImpactCzk: number; transferCount: number }
export type OverviewMetrics = {
  range: { dateFrom: string; dateTo: string; earliestActivityDate: string | null; granularity: OverviewGranularity }
  wealth: { amountCzk: number; changeCzk: number }
  flow: { incomeCzk: number; expenseCzk: number; cashflowCzk: number }
  wealthSeries: Array<{ date: string; valueCzk: number }>
  flowSeries: Array<{ date: string; incomeCzk: number; expenseCzk: number }>
  categories: OverviewCategory[]
  labels: OverviewLabel[]
}

export async function getOverview({ walletIds, period, dateFrom, dateTo, search, signal }: { walletIds?: string[]; period: FeedPeriod; dateFrom?: string; dateTo?: string; search?: string; signal?: AbortSignal }) {
  const query = new URLSearchParams({ period })
  if (walletIds?.length) query.set('walletIds', walletIds.join(','))
  if (dateFrom) query.set('dateFrom', dateFrom)
  if (dateTo) query.set('dateTo', dateTo)
  if (search) query.set('search', search)
  return apiRequest<OverviewMetrics>(`/overview?${query.toString()}`, { signal })
}

export type OverviewSelectionTrend = { previous: { amountCzk: number }; series: Array<{ date: string; amountCzk: number }> }

export async function getOverviewSelectionTrend({ type, id, walletIds, dateFrom, dateTo, granularity, search, signal }: { type: OverviewSelectionType; id?: string; walletIds?: string[]; dateFrom: string; dateTo: string; granularity: OverviewGranularity; search?: string; signal?: AbortSignal }) {
  const query = new URLSearchParams({ type, dateFrom, dateTo, granularity })
  if (id) query.set('id', id)
  if (walletIds?.length) query.set('walletIds', walletIds.join(','))
  if (search) query.set('search', search)
  return apiRequest<OverviewSelectionTrend>(`/overview/selection?${query.toString()}`, { signal })
}
