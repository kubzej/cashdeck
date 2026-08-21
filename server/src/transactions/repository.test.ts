import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createTransactionRepository } from './repository.js'

test('updateTransaction with an empty labelIds array actually removes existing label associations, not just skips adding new ones', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce(undefined) // begin
    .mockResolvedValueOnce({ rows: [{ exists: true }] }) // transactionExists (no other field changed)
    .mockResolvedValueOnce(undefined) // delete transaction_labels
    .mockResolvedValueOnce({ rows: [{ id: 'transaction-1', wallet_id: 'wallet-1', wallet_name: 'Účet', category_id: 'category-1', category_name: 'Jídlo', category_icon_key: 'utensils', category_color_key: 'orange', direction: 'expense', amount_czk: '250', transaction_date: '2026-08-21', note: null, created_at: new Date(), labels: [] }] }) // requireTransaction
    .mockResolvedValueOnce(undefined) // commit
  const client = { query, release: vi.fn() }
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const repository = createTransactionRepository(pool)

  const result = await repository.updateTransaction('user-1', 'transaction-1', { labelIds: [] })

  const deleteCall = query.mock.calls.find(([sql]) => String(sql).toLowerCase().includes('delete from transaction_labels'))
  expect(deleteCall).toBeDefined()
  expect(deleteCall![1]).toEqual(['user-1', 'transaction-1'])
  const insertCall = query.mock.calls.find(([sql]) => String(sql).toLowerCase().includes('insert into transaction_labels'))
  expect(insertCall).toBeUndefined()
  expect(result?.labels).toEqual([])
})
