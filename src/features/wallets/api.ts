import { apiRequest } from '../../lib/api-client'

export const walletColorKeys = [
  'slate', 'red', 'orange', 'amber', 'lime', 'green', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'pink', 'rose',
] as const

export type WalletColorKey = (typeof walletColorKeys)[number]

export type Wallet = {
  id: string
  name: string
  colorKey: WalletColorKey
  openingBalanceCzk: number
  openingBalanceDate: string
  sortOrder: number
  isHidden: boolean
  openingBalanceLocked: boolean
}

export type CreateWalletInput = Pick<Wallet, 'name' | 'colorKey' | 'openingBalanceCzk' | 'openingBalanceDate'>

export async function listWallets() {
  return apiRequest<{ items: Wallet[] }>('/wallets')
}

export async function createWallet(input: CreateWalletInput) {
  return apiRequest<Wallet>('/wallets', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function reorderWallets(walletIds: string[]) {
  await apiRequest<void>('/wallets/order', {
    method: 'PUT',
    body: JSON.stringify({ walletIds }),
  })
}

export async function updateWallet(walletId: string, input: CreateWalletInput) {
  return apiRequest<Wallet>(`/wallets/${walletId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteWallet(walletId: string) {
  await apiRequest<void>(`/wallets/${walletId}`, { method: 'DELETE' })
}
