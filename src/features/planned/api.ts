import { apiRequest } from '../../lib/api-client'
import type { Transaction } from '../transactions/api'
import type { Transfer } from '../transfers/api'

export type PlannedTransaction = Transaction & {
  kind: 'transaction'
  origin: 'manual' | 'recurring'
  recurringRuleId: string | null
  recurringRuleName: string | null
}

export type PlannedTransfer = Transfer & {
  kind: 'transfer'
  origin: 'manual' | 'recurring'
  recurringRuleId: string | null
  recurringRuleName: string | null
  impactCzk: number
}

export type PlannedItem = PlannedTransaction | PlannedTransfer
export type PlannedSummary = { count: number; totalCzk: number }
export type PlannedResult = { items: PlannedItem[]; summary: PlannedSummary }

export function listPlanned({ walletIds, dateFrom, dateTo, categoryId, labelId, signal }: { walletIds?: string[]; dateFrom: string; dateTo: string; categoryId?: string; labelId?: string; signal?: AbortSignal }) {
  const query = new URLSearchParams({ dateFrom, dateTo })
  if (walletIds?.length) query.set('walletIds', walletIds.join(','))
  if (categoryId) query.set('categoryId', categoryId)
  if (labelId) query.set('labelId', labelId)
  return apiRequest<PlannedResult>(`/planned?${query.toString()}`, { signal })
}
