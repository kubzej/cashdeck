import { apiRequest } from '../../lib/api-client'
import type { CategoryColorKey, CategoryDirection, CategoryIconKey } from '../categories/api'

export const recurringFrequencies = [
  'daily', 'weekly', 'biweekly', 'monthly', 'every_two_months',
  'every_three_months', 'semiannual', 'yearly', 'custom_days',
] as const

export type RecurringFrequency = (typeof recurringFrequencies)[number]
export type RecurringRuleKind = 'transaction' | 'transfer'

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

export function createRecurringRule(input: RecurringRuleInput) {
  return apiRequest<RecurringRule>('/recurring-rules', { method: 'POST', body: JSON.stringify(input) })
}

export function updateRecurringRule(ruleId: string, input: RecurringRuleInput) {
  return apiRequest<RecurringRule>(`/recurring-rules/${ruleId}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export async function deleteRecurringRule(ruleId: string) {
  await apiRequest<void>(`/recurring-rules/${ruleId}`, { method: 'DELETE' })
}
