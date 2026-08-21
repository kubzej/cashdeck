import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createApp } from '../app.js'
import { jwtVerify } from 'jose'
import type { ServerConfig } from '../config.js'

const config: ServerConfig = {
  databaseUrl: 'postgres://unused',
  frontendOrigin: 'http://localhost:5173',
  host: '127.0.0.1',
  port: 8000,
  sessionSigningSecret: 'test-session-signing-secret-32-characters-long',
  appAccessPassphrase: 'correct horse battery staple',
  appUserId: 'user-123',
}

async function createTestApp() {
  return createApp({ config, database: { end: vi.fn() } as unknown as Pool })
}

test('issues a bearer token for the correct passphrase, scoped to the configured app user', async () => {
  const app = await createTestApp()

  const response = await app.inject({ method: 'POST', url: '/api/unlock', payload: { passphrase: 'correct horse battery staple' } })

  expect(response.statusCode).toBe(200)
  const { token } = response.json()
  expect(typeof token).toBe('string')
  const { payload } = await jwtVerify(token, new TextEncoder().encode(config.sessionSigningSecret), { algorithms: ['HS256'] })
  expect(payload.sub).toBe('user-123')
  await app.close()
})

test('rejects an incorrect passphrase without issuing a token', async () => {
  const app = await createTestApp()

  const response = await app.inject({ method: 'POST', url: '/api/unlock', payload: { passphrase: 'wrong guess' } })

  expect(response.statusCode).toBe(401)
  expect(response.json()).toEqual({ error: 'Nesprávné heslo.' })
  await app.close()
})

test('rejects a missing passphrase', async () => {
  const app = await createTestApp()

  const response = await app.inject({ method: 'POST', url: '/api/unlock', payload: {} })

  expect(response.statusCode).toBe(401)
  await app.close()
})

test('rejects a malformed request body', async () => {
  const app = await createTestApp()

  const response = await app.inject({ method: 'POST', url: '/api/unlock', payload: { passphrase: 12345 } })

  expect(response.statusCode).toBe(401)
  await app.close()
})

test('the issued token is accepted by protected routes', async () => {
  const app = await createTestApp()

  const unlockResponse = await app.inject({ method: 'POST', url: '/api/unlock', payload: { passphrase: 'correct horse battery staple' } })
  const { token } = unlockResponse.json()

  const sessionResponse = await app.inject({ method: 'GET', url: '/api/session', headers: { authorization: `Bearer ${token}` } })

  expect(sessionResponse.statusCode).toBe(200)
  expect(sessionResponse.json()).toEqual({ userId: 'user-123' })
  await app.close()
})
