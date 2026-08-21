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

export type TransferInput = {
  sourceWalletId: string
  destinationWalletId: string
  amountCzk: number
  transferDate: string
  note: string | null
  labelIds: string[]
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
