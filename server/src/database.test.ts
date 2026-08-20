import { expect, test, vi } from 'vitest'
import { verifyDatabaseConnection } from './database.js'

test('verifies the database connection with a bounded probe', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] })

  await verifyDatabaseConnection({ query } as never)

  expect(query).toHaveBeenCalledOnce()
  expect(query).toHaveBeenCalledWith('select 1')
})
