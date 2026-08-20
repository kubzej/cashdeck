import { apiRequest } from '../../lib/api-client'
import type { CategoryColorKey, CategoryDirection, CategoryIconKey } from '../categories/api'

export type TransactionLabel = {
  id: string
  name: string
}

export type Transaction = {
  id: string
  walletId: string
  walletName: string
  categoryId: string
  categoryName: string
  categoryIconKey: CategoryIconKey
  categoryColorKey: CategoryColorKey
  direction: CategoryDirection
  amountCzk: number
  transactionDate: string
  note: string | null
  labels: TransactionLabel[]
}

export type TransactionPage = {
  items: Transaction[]
  nextCursor: string | null
}

export type CreateTransactionInput = {
  walletId: string
  categoryId: string
  amountCzk: number
  transactionDate: string
  note: string | null
  labelIds: string[]
}

export async function listTransactions({ walletId, dateFrom, dateTo, cursor, limit = 50 }: { walletId?: string; dateFrom?: string; dateTo?: string; cursor?: string; limit?: number } = {}) {
  const search = new URLSearchParams({ limit: String(limit) })
  if (walletId) search.set('walletId', walletId)
  if (dateFrom) search.set('dateFrom', dateFrom)
  if (dateTo) search.set('dateTo', dateTo)
  if (cursor) search.set('cursor', cursor)
  return apiRequest<TransactionPage>(`/transactions?${search.toString()}`)
}

export async function createTransaction(input: CreateTransactionInput) {
  return apiRequest<Transaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateTransaction(transactionId: string, input: CreateTransactionInput) {
  return apiRequest<Transaction>(`/transactions/${transactionId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteTransaction(transactionId: string) {
  await apiRequest<void>(`/transactions/${transactionId}`, { method: 'DELETE' })
}
