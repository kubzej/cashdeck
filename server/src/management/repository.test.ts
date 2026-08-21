import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createManagementRepository } from './repository.js'

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
