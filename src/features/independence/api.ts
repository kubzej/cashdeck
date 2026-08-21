import { apiRequest } from '../../lib/api-client'

export type IndependenceSettings = {
  withdrawalRatePercent: number
  expectedRealReturnPercent: number
  inflationRatePercent: number
  monthlyContributionCzk: number
  housingMonthlyCzk: number
  foodMonthlyCzk: number
  transportMonthlyCzk: number
  healthMonthlyCzk: number
  leisureMonthlyCzk: number
  clothingMonthlyCzk: number
  familyMonthlyCzk: number
  reserveMonthlyCzk: number
}

export type IrregularExpense = {
  id: string
  name: string
  amountCzk: number
  frequencyYears: number
  sortOrder: number
}

export type IrregularExpenseInput = { name: string; amountCzk: number; frequencyYears: number }

export type IndependenceProgress = {
  hasSettings: boolean
  annualExpensesCzk: number
  independenceNumberCzk: number
  totalWealthCzk: number
  availableWealthCzk: number
  totalProgressPercent: number
  availableProgressPercent: number
  yearsToTotal: number | null
  yearsToAvailable: number | null
  futureAnnualExpensesCzk: number | null
}

export async function getIndependenceSettings() {
  return apiRequest<{ settings: IndependenceSettings | null }>('/independence/settings')
}

export async function saveIndependenceSettings(input: IndependenceSettings) {
  return apiRequest<{ settings: IndependenceSettings }>('/independence/settings', { method: 'PUT', body: JSON.stringify(input) })
}

export async function listIrregularExpenses() {
  return apiRequest<{ items: IrregularExpense[] }>('/independence/irregular-expenses')
}

export async function createIrregularExpense(input: IrregularExpenseInput) {
  return apiRequest<IrregularExpense>('/independence/irregular-expenses', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateIrregularExpense(id: string, input: Partial<IrregularExpenseInput>) {
  return apiRequest<IrregularExpense>(`/independence/irregular-expenses/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export async function deleteIrregularExpense(id: string) {
  await apiRequest<void>(`/independence/irregular-expenses/${id}`, { method: 'DELETE' })
}

export async function getIndependenceProgress() {
  return apiRequest<IndependenceProgress>('/independence/progress')
}

export async function getIndependenceWealthSeries() {
  return apiRequest<{ points: Array<{ date: string; amountCzk: number }> }>('/independence/wealth-series')
}
