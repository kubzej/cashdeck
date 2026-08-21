import { apiRequest } from '../../lib/api-client'
import type { FeedPeriod } from '../feed/feed-filters'

export type OverviewGranularity = 'day' | 'month' | 'quarter'
export type OverviewCategory = { id: string; name: string; iconKey: string; colorKey: string; direction: 'income' | 'expense'; amountCzk: number; transactionCount: number }
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

export async function getOverview({ walletIds, period, dateFrom, dateTo, signal }: { walletIds?: string[]; period: FeedPeriod; dateFrom?: string; dateTo?: string; signal?: AbortSignal }) {
  const query = new URLSearchParams({ period })
  if (walletIds?.length) query.set('walletIds', walletIds.join(','))
  if (dateFrom) query.set('dateFrom', dateFrom)
  if (dateTo) query.set('dateTo', dateTo)
  return apiRequest<OverviewMetrics>(`/overview?${query.toString()}`, { signal })
}

export type OverviewSelectionType = 'category' | 'label'
export type OverviewSelectionTrend = { previous: { amountCzk: number }; series: Array<{ date: string; amountCzk: number }> }

export async function getOverviewSelectionTrend({ type, id, walletIds, dateFrom, dateTo, granularity, signal }: { type: OverviewSelectionType; id: string; walletIds?: string[]; dateFrom: string; dateTo: string; granularity: OverviewGranularity; signal?: AbortSignal }) {
  const query = new URLSearchParams({ type, id, dateFrom, dateTo, granularity })
  if (walletIds?.length) query.set('walletIds', walletIds.join(','))
  return apiRequest<OverviewSelectionTrend>(`/overview/selection?${query.toString()}`, { signal })
}
