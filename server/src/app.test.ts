import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createApp } from './app.js'
import type { ServerConfig } from './config.js'

const config: ServerConfig = {
  databaseUrl: 'postgres://unused',
  frontendOrigin: 'http://localhost:5173',
  host: '127.0.0.1',
  port: 8000,
  sessionSigningSecret: 'test-session-signing-secret-32-characters-long',
  appAccessPassphrase: 'test-passphrase',
  appUserId: 'test-user-id',
}

async function createTestApp(query: ReturnType<typeof vi.fn>) {
  return createApp({ config, database: { query, end: vi.fn() } as unknown as Pool })
}

test('/health answers without touching the database', async () => {
  const query = vi.fn()
  const app = await createTestApp(query)

  const response = await app.inject({ method: 'GET', url: '/health' })

  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ status: 'ok' })
  expect(query).not.toHaveBeenCalled()
  await app.close()
})

test('/health/ready is 200 when the database answers and 503 when it does not', async () => {
  const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('connection refused'))
  const app = await createTestApp(query)

  const ready = await app.inject({ method: 'GET', url: '/health/ready' })
  expect(ready.statusCode).toBe(200)
  expect(ready.json()).toEqual({ status: 'ok' })

  const down = await app.inject({ method: 'GET', url: '/health/ready' })
  expect(down.statusCode).toBe(503)
  expect(down.json()).toEqual({ status: 'unavailable' })
  await app.close()
})
