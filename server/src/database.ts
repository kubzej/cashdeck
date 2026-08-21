import { Pool } from 'pg'

export function createDatabasePool(databaseUrl: string) {
  return new Pool({ connectionString: databaseUrl })
}

export async function verifyDatabaseConnection(pool: Pool) {
  await pool.query('select 1')
}
