import { Pool, type PoolClient } from 'pg'

export function createDatabasePool(databaseUrl: string, onIdleClientError: (error: Error) => void) {
  const pool = new Pool({
    connectionString: databaseUrl,
    // Generous enough for a Neon compute waking from suspend; without it a stalled connect
    // attempt hangs the request forever.
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  })
  // Neon drops idle connections when its compute suspends. pg reports that as an 'error' event
  // on the pool, and an unhandled 'error' event crashes the process.
  pool.on('error', onIdleClientError)
  return pool
}

export async function verifyDatabaseConnection(pool: Pool) {
  await pool.query('select 1')
}

/** True when the database answers `select 1` within `timeoutMs`; never throws. */
export async function isDatabaseReachable(pool: Pool, timeoutMs: number) {
  let timer: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      pool.query('select 1'),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Database check timed out')), timeoutMs) }),
    ])
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function withTransaction<T>(pool: Pool, callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await callback(client)
    await client.query('commit')
    client.release()
    return result
  } catch (error) {
    try {
      await client.query('rollback')
      client.release()
    } catch (rollbackError) {
      // A failed rollback means the connection is broken: passing the error to release() makes
      // the pool destroy it instead of handing it to the next request. The original error is
      // the one worth surfacing.
      client.release(rollbackError instanceof Error ? rollbackError : true)
    }
    throw error
  }
}
