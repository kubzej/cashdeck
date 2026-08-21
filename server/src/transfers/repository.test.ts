import type { Pool } from 'pg'
import { beforeEach, expect, test, vi } from 'vitest'
import { invalidateWealthCache } from '../wealth-cache.js'
import { createTransferRepository } from './repository.js'

vi.mock('../wealth-cache.js', () => ({ invalidateWealthCache: vi.fn() }))
beforeEach(() => vi.mocked(invalidateWealthCache).mockClear())

test('listTransfers excludes transfers where either wallet endpoint is hidden', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const repository = createTransferRepository({ query } as unknown as Pool)

  await repository.listTransfers('user-1', { walletId: null, dateFrom: null, dateTo: null, cursor: null, limit: 20 })

  const [sql] = query.mock.calls[0]
  const normalized = String(sql).replace(/\s+/g, ' ')
  expect(normalized).toContain('not source_wallet_filter.is_hidden')
  expect(normalized).toContain('not destination_wallet_filter.is_hidden')
})

test('updateTransfer persists a changed destination wallet so both old and new wallet balances recalculate from it', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce(undefined) // begin
    .mockResolvedValueOnce({ rows: [{ source_wallet_id: 'wallet-1', destination_wallet_id: 'wallet-2' }] }) // existing, for update
    .mockResolvedValueOnce(undefined) // update transfers
    .mockResolvedValueOnce(undefined) // delete transfer_labels
    .mockResolvedValueOnce({ rows: [{ id: 'transfer-1', source_wallet_id: 'wallet-1', destination_wallet_id: 'wallet-3', amount_czk: '500', transfer_date: '2026-08-21', note: null, created_at: new Date(), labels: [] }] }) // requireTransfer
    .mockResolvedValueOnce(undefined) // commit
  const client = { query, release: vi.fn() }
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const repository = createTransferRepository(pool)

  await repository.updateTransfer('user-1', 'transfer-1', { destinationWalletId: 'wallet-3', labelIds: [] })

  const updateCall = query.mock.calls.find(([sql]) => String(sql).toLowerCase().includes('update transfers'))
  expect(updateCall).toBeDefined()
  const [updateSql, updateValues] = updateCall!
  expect(String(updateSql)).toContain('destination_wallet_id = $3')
  expect(updateValues).toEqual(['user-1', 'transfer-1', 'wallet-3'])
  expect(invalidateWealthCache).toHaveBeenCalledTimes(1)
})

test('createTransfer rolls back and releases the client if a write fails mid-transaction', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce(undefined) // begin
    .mockResolvedValueOnce({ rows: [{ id: 'transfer-1' }] }) // insert transfers
    .mockRejectedValueOnce(new Error('boom')) // replaceTransferLabels label-existence check fails
    .mockResolvedValueOnce(undefined) // rollback
  const release = vi.fn()
  const client = { query, release }
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const repository = createTransferRepository(pool)

  await expect(repository.createTransfer('user-1', {
    sourceWalletId: 'wallet-1',
    destinationWalletId: 'wallet-2',
    amountCzk: 500,
    transferDate: '2026-08-21',
    note: null,
    labelIds: ['label-1'],
  })).rejects.toThrow('boom')

  expect(query).toHaveBeenCalledWith('rollback')
  expect(query).not.toHaveBeenCalledWith('commit')
  expect(release).toHaveBeenCalledTimes(1)
  expect(invalidateWealthCache).not.toHaveBeenCalled()
})
