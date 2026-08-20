import { apiRequest } from '../../lib/api-client'

export type TransferLabel = {
  id: string
  name: string
}

export type Transfer = {
  id: string
  sourceWalletId: string
  sourceWalletName: string
  destinationWalletId: string
  destinationWalletName: string
  amountCzk: number
  transferDate: string
  note: string | null
  labels: TransferLabel[]
}

export type TransferPage = {
  items: Transfer[]
  nextCursor: string | null
}

export type TransferInput = {
  sourceWalletId: string
  destinationWalletId: string
  amountCzk: number
  transferDate: string
  note: string | null
  labelIds: string[]
}

export async function listTransfers({ walletId, dateFrom, dateTo, cursor, limit = 50 }: { walletId?: string; dateFrom?: string; dateTo?: string; cursor?: string; limit?: number } = {}) {
  const search = new URLSearchParams({ limit: String(limit) })
  if (walletId) search.set('walletId', walletId)
  if (dateFrom) search.set('dateFrom', dateFrom)
  if (dateTo) search.set('dateTo', dateTo)
  if (cursor) search.set('cursor', cursor)
  return apiRequest<TransferPage>(`/transfers?${search.toString()}`)
}

export function createTransfer(input: TransferInput) {
  return apiRequest<Transfer>('/transfers', { method: 'POST', body: JSON.stringify(input) })
}

export function updateTransfer(transferId: string, input: TransferInput) {
  return apiRequest<Transfer>(`/transfers/${transferId}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export async function deleteTransfer(transferId: string) {
  await apiRequest<void>(`/transfers/${transferId}`, { method: 'DELETE' })
}
