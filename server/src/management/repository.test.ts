// Repository tests run against a mocked `pg` pool: they check which queries and parameters the
// repository sends and how it handles the rows it is handed (transactions, cache invalidation,
// validation), never what Postgres would return. SQL correctness is not covered here.

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

test('listLabels rejects a cursor whose id is not a UUID before querying', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const repository = createManagementRepository({ query } as unknown as Pool)
  const cursor = Buffer.from(JSON.stringify({ name: 'jidlo', id: 'not-a-uuid' })).toString('base64url')

  await expect(repository.listLabels('user-1', null, cursor, 20, 'alphabetical')).rejects.toMatchObject({ statusCode: 400 })
  expect(query).not.toHaveBeenCalled()
})

test('label search text is escaped before it is wrapped in the LIKE pattern', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const repository = createManagementRepository({ query } as unknown as Pool)

  await repository.listLabels('user-1', '100%_', null, 20, 'alphabetical')
  await repository.listLabels('user-1', '100%_', null, 20, 'recent')

  for (const [, values] of query.mock.calls) expect(values).toContain('%100\\%\\_%')
})

test('updateWallet invalidates the wealth cache only when a wallet was actually changed', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ id: 'wallet-1' }] }) // update ... returning id
    .mockResolvedValueOnce({ rows: [] }) // getWallet read-back
    .mockResolvedValueOnce({ rows: [] }) // update on a wallet that is not the user's
  const repository = createManagementRepository({ query } as unknown as Pool)

  await repository.updateWallet('user-1', 'wallet-1', { name: 'Nový název' })
  expect(invalidateWealthCache).toHaveBeenCalledTimes(1)

  expect(await repository.updateWallet('user-1', 'wallet-2', { name: 'Cizí' })).toBeNull()
  expect(invalidateWealthCache).toHaveBeenCalledTimes(1)
})

function adjustmentClient(currentBalanceCzk: string) {
  return {
    query: vi.fn()
      .mockResolvedValueOnce(undefined) // begin
      .mockResolvedValueOnce({ rows: [{ id: 'wallet-1' }] }) // lock wallet
      .mockResolvedValueOnce({ rows: [{ current_balance_czk: currentBalanceCzk }] }) // current balance
      .mockResolvedValueOnce({ rows: [{ id: 'adjustment-1', wallet_id: 'wallet-1', amount_czk: '500', operation: 'add', adjustment_date: '2026-08-21' }] }) // insert
      .mockResolvedValueOnce(undefined), // commit
    release: vi.fn(),
  }
}

test('a balance adjustment invalidates the wealth cache after it is committed', async () => {
  const client = adjustmentClient('1000')
  const repository = createManagementRepository({ connect: vi.fn().mockResolvedValue(client) } as unknown as Pool)

  const result = await repository.createBalanceAdjustment('user-1', 'wallet-1', 1500)

  expect(result?.adjustment).toMatchObject({ amountCzk: 500, operation: 'add' })
  expect(client.query).toHaveBeenCalledWith('commit')
  expect(invalidateWealthCache).toHaveBeenCalledTimes(1)
})

test('a balance that already matches writes nothing and leaves the wealth cache alone', async () => {
  const client = {
    query: vi.fn()
      .mockResolvedValueOnce(undefined) // begin
      .mockResolvedValueOnce({ rows: [{ id: 'wallet-1' }] }) // lock wallet
      .mockResolvedValueOnce({ rows: [{ current_balance_czk: '1000' }] }) // current balance
      .mockResolvedValueOnce(undefined), // commit
    release: vi.fn(),
  }
  const repository = createManagementRepository({ connect: vi.fn().mockResolvedValue(client) } as unknown as Pool)

  const result = await repository.createBalanceAdjustment('user-1', 'wallet-1', 1000)

  expect(result?.adjustment).toBeNull()
  expect(invalidateWealthCache).not.toHaveBeenCalled()
})
