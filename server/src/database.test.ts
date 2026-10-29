import { afterEach, expect, test, vi } from 'vitest'
import { createDatabasePool, isDatabaseReachable, verifyDatabaseConnection, withTransaction } from './database.js'

afterEach(() => vi.useRealTimers())

test('verifies the database connection with a bounded probe', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] })

  await verifyDatabaseConnection({ query } as never)

  expect(query).toHaveBeenCalledOnce()
  expect(query).toHaveBeenCalledWith('select 1')
})

test('the pool reports idle client errors instead of crashing the process, and bounds connects and statements', () => {
  const onIdleClientError = vi.fn()
  const pool = createDatabasePool('postgres://user:secret@127.0.0.1:1/cashdeck', onIdleClientError)
  const idleError = new Error('terminating connection due to administrator command')

  expect(() => pool.emit('error', idleError)).not.toThrow()
  expect(onIdleClientError).toHaveBeenCalledWith(idleError)
  expect(pool.options.connectionTimeoutMillis).toBe(10_000)
  expect((pool.options as { statement_timeout?: number }).statement_timeout).toBe(15_000)
})

function createTransactionPool(client: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }) {
  return { connect: vi.fn().mockResolvedValue(client) } as never
}

test('withTransaction commits and returns the callback result', async () => {
  const client = { query: vi.fn().mockResolvedValue(undefined), release: vi.fn() }

  await expect(withTransaction(createTransactionPool(client), async () => 'done')).resolves.toBe('done')

  expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(['begin', 'commit'])
  expect(client.release).toHaveBeenCalledWith()
})

test('withTransaction rolls back and rethrows the original error', async () => {
  const client = { query: vi.fn().mockResolvedValue(undefined), release: vi.fn() }
  const failure = new Error('insert failed')

  await expect(withTransaction(createTransactionPool(client), async () => { throw failure })).rejects.toBe(failure)

  expect(client.query).toHaveBeenLastCalledWith('rollback')
  expect(client.release).toHaveBeenCalledWith()
})

test('withTransaction keeps the original error and discards the connection when rollback itself fails', async () => {
  const rollbackFailure = new Error('Connection terminated')
  const client = {
    query: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(rollbackFailure),
    release: vi.fn(),
  }
  const failure = new Error('insert failed')

  await expect(withTransaction(createTransactionPool(client), async () => { throw failure })).rejects.toBe(failure)

  expect(client.release).toHaveBeenCalledWith(rollbackFailure)
})

test('isDatabaseReachable is true when the probe answers', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  expect(await isDatabaseReachable({ query } as never, 1000)).toBe(true)
})

test('isDatabaseReachable is false, not an error, when the probe fails', async () => {
  const query = vi.fn().mockRejectedValue(new Error('connection refused'))
  expect(await isDatabaseReachable({ query } as never, 1000)).toBe(false)
})

test('isDatabaseReachable gives up on a probe that never answers', async () => {
  vi.useFakeTimers()
  const query = vi.fn().mockReturnValue(new Promise(() => {}))
  const result = isDatabaseReachable({ query } as never, 3000)
  await vi.advanceTimersByTimeAsync(3000)
  expect(await result).toBe(false)
})
