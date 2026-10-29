import { apiRequest } from '../../lib/api-client'
import { recurringFrequencies, type RecurringFrequency, type RecurringRuleKind } from '../../../server/src/catalog'
import type { CategoryColorKey, CategoryDirection, CategoryIconKey } from '../categories/api'

export { recurringFrequencies, type RecurringFrequency, type RecurringRuleKind }

export type RecurringRuleLabel = { id: string; name: string }

export type RecurringRule = {
  id: string
  name: string
  kind: RecurringRuleKind
  amountCzk: number
  walletId: string | null
  walletName: string | null
  categoryId: string | null
  categoryName: string | null
  categoryIconKey: CategoryIconKey | null
  categoryColorKey: CategoryColorKey | null
  categoryDirection: CategoryDirection | null
  sourceWalletId: string | null
  sourceWalletName: string | null
  destinationWalletId: string | null
  destinationWalletName: string | null
  note: string | null
  labels: RecurringRuleLabel[]
  frequency: RecurringFrequency
  customIntervalDays: number | null
  nextOccurrenceDate: string
  endsOn: string | null
  status: 'active' | 'ended'
  sortOrder: number
}

export type RecurringRuleInput = {
  name: string
  kind: RecurringRuleKind
  amountCzk: number
  walletId?: string
  categoryId?: string
  sourceWalletId?: string
  destinationWalletId?: string
  note: string | null
  labelIds: string[]
  frequency: RecurringFrequency
  customIntervalDays: number | null
  nextOccurrenceDate: string
  endsOn: string | null
}

export function listRecurringRules() {
  return apiRequest<RecurringRule[]>('/recurring-rules')
}

export async function reorderRecurringRules(ruleIds: string[]) {
  await apiRequest<void>('/recurring-rules/order', { method: 'PUT', body: JSON.stringify({ ruleIds }) })
}

export function createRecurringRule(input: RecurringRuleInput) {
  return apiRequest<RecurringRule>('/recurring-rules', { method: 'POST', body: JSON.stringify(input) })
}

export function updateRecurringRule(ruleId: string, input: RecurringRuleInput) {
  return apiRequest<RecurringRule>(`/recurring-rules/${ruleId}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export async function deleteRecurringRule(ruleId: string) {
  await apiRequest<void>(`/recurring-rules/${ruleId}`, { method: 'DELETE' })
}
