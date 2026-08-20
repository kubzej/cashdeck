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

export type CreateTransactionInput = {
  walletId: string
  categoryId: string
  amountCzk: number
  transactionDate: string
  note: string | null
  labelIds: string[]
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
