import { apiRequest } from '../../lib/api-client'
import { colorKeys, type ColorKey } from '../../lib/color-keys'

export const walletColorKeys = colorKeys
export type WalletColorKey = ColorKey

export type Wallet = {
  id: string
  name: string
  colorKey: WalletColorKey
  openingBalanceCzk: number
  currentBalanceCzk?: number
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
