import type { Pool } from 'pg'
import { beforeEach, expect, test, vi } from 'vitest'
import { invalidateWealthCache } from '../wealth-cache.js'
import { createManagementRepository } from './repository.js'

vi.mock('../wealth-cache.js', () => ({ invalidateWealthCache: vi.fn() }))
beforeEach(() => vi.mocked(invalidateWealthCache).mockClear())

test('wallet balance derivation includes same-day records on or after the opening balance date', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const repository = createManagementRepository({ query } as unknown as Pool)

  await repository.listWallets('user-1', false)

  const [sql] = query.mock.calls[0]
  const normalized = String(sql).replace(/\s+/g, ' ')
  expect(normalized).toContain('t.transaction_date >= w.opening_balance_date')
  expect(normalized).toContain('tr.transfer_date >= w.opening_balance_date')
  expect(normalized).toContain('ba.adjustment_date >= w.opening_balance_date')
})

test('reorderWallets rejects a stale or incomplete wallet id set without writing anything', async () => {
  const client = {
    query: vi.fn().mockResolvedValueOnce(undefined) // begin
      .mockResolvedValueOnce({ rows: [{ id: 'wallet-1' }, { id: 'wallet-2' }] }) // current ids, locked
      .mockResolvedValueOnce(undefined), // rollback
    release: vi.fn(),
  }
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const repository = createManagementRepository(pool)

  await expect(repository.reorderWallets('user-1', ['wallet-1'])).rejects.toMatchObject({
    statusCode: 409,
    message: 'Pořadí peněženek neodpovídá aktuálním datům.',
  })

  const writeCalls = client.query.mock.calls.filter(([sql]) => String(sql).toLowerCase().includes('update wallets'))
  expect(writeCalls).toHaveLength(0)
  expect(client.query).toHaveBeenCalledWith('rollback')
})

test('createWallet and deleteWallet both invalidate the wealth cache', async () => {
  const walletRow = { id: 'wallet-1', name: 'AirBank', color_key: 'teal', wallet_type: 'other', counts_toward_independence: false, available_now: false, opening_balance_czk: '0', current_balance_czk: '0', opening_balance_date: '2026-08-21', sort_order: 0, is_hidden: false, opening_balance_locked: false }
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [walletRow] }) // createWallet insert
    .mockResolvedValueOnce({ rows: [{ id: 'wallet-1' }] }) // deleteWallet
  const repository = createManagementRepository({ query } as unknown as Pool)

  await repository.createWallet('user-1', { name: 'AirBank', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-08-21' })
  expect(invalidateWealthCache).toHaveBeenCalledTimes(1)

  await repository.deleteWallet('user-1', 'wallet-1')
  expect(invalidateWealthCache).toHaveBeenCalledTimes(2)
})
