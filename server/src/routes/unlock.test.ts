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
  expect(sessionResponse.json()).toMatchObject({ userId: 'user-123' })
  await app.close()
})

test('issued tokens expire after 30 days', async () => {
  const app = await createTestApp()

  const response = await app.inject({ method: 'POST', url: '/api/unlock', payload: { passphrase: 'correct horse battery staple' } })
  const { payload } = await jwtVerify(response.json().token, new TextEncoder().encode(config.sessionSigningSecret), { algorithms: ['HS256'] })

  expect(payload.exp! - payload.iat!).toBe(30 * 24 * 60 * 60)
  await app.close()
})

test('session verification returns a fresh token for the same user', async () => {
  const app = await createTestApp()
  const unlockResponse = await app.inject({ method: 'POST', url: '/api/unlock', payload: { passphrase: 'correct horse battery staple' } })

  const sessionResponse = await app.inject({ method: 'GET', url: '/api/session', headers: { authorization: `Bearer ${unlockResponse.json().token}` } })

  const { token } = sessionResponse.json()
  const { payload } = await jwtVerify(token, new TextEncoder().encode(config.sessionSigningSecret), { algorithms: ['HS256'] })
  expect(payload.sub).toBe('user-123')
  const renewed = await app.inject({ method: 'GET', url: '/api/session', headers: { authorization: `Bearer ${token}` } })
  expect(renewed.statusCode).toBe(200)
  await app.close()
})

test('blocks a client after five failed attempts, even with the correct passphrase', async () => {
  const app = await createTestApp()
  const headers = { 'x-forwarded-for': '203.0.113.7' }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await app.inject({ method: 'POST', url: '/api/unlock', headers, payload: { passphrase: 'wrong guess' } })
    expect(response.statusCode).toBe(401)
  }

  const blocked = await app.inject({ method: 'POST', url: '/api/unlock', headers, payload: { passphrase: 'correct horse battery staple' } })
  expect(blocked.statusCode).toBe(429)
  expect(blocked.headers['retry-after']).toBe('900')
  expect(blocked.json()).toEqual({ error: 'Příliš mnoho pokusů. Zkus to později.' })

  const otherClient = await app.inject({ method: 'POST', url: '/api/unlock', headers: { 'x-forwarded-for': '198.51.100.4' }, payload: { passphrase: 'correct horse battery staple' } })
  expect(otherClient.statusCode).toBe(200)
  await app.close()
})

test('a spoofed leading X-Forwarded-For entry does not give the caller a fresh rate-limit identity', async () => {
  const app = await createTestApp()

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await app.inject({ method: 'POST', url: '/api/unlock', headers: { 'x-forwarded-for': `10.0.0.${attempt}, 203.0.113.7` }, payload: { passphrase: 'wrong guess' } })
  }

  const blocked = await app.inject({ method: 'POST', url: '/api/unlock', headers: { 'x-forwarded-for': '10.0.0.99, 203.0.113.7' }, payload: { passphrase: 'wrong guess' } })
  expect(blocked.statusCode).toBe(429)
  await app.close()
})

test('blocks all clients once the global failure limit is reached', async () => {
  const app = await createTestApp()

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await app.inject({ method: 'POST', url: '/api/unlock', headers: { 'x-forwarded-for': `203.0.113.${attempt}` }, payload: { passphrase: 'wrong guess' } })
  }

  const blocked = await app.inject({ method: 'POST', url: '/api/unlock', headers: { 'x-forwarded-for': '198.51.100.4' }, payload: { passphrase: 'correct horse battery staple' } })
  expect(blocked.statusCode).toBe(429)
  await app.close()
})

test('malformed request bodies are rejected as client errors, not server errors', async () => {
  const app = await createTestApp()

  const invalidJson = await app.inject({ method: 'POST', url: '/api/unlock', headers: { 'content-type': 'application/json' }, payload: '{"passphrase":' })
  expect(invalidJson.statusCode).toBe(400)
  expect(invalidJson.json()).toEqual({ error: 'Neplatný požadavek.' })

  const unsupportedType = await app.inject({ method: 'POST', url: '/api/unlock', headers: { 'content-type': 'application/xml' }, payload: '<passphrase/>' })
  expect(unsupportedType.statusCode).toBe(415)

  const oversized = await app.inject({ method: 'POST', url: '/api/unlock', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ passphrase: 'x'.repeat(2 * 1024 * 1024) }) })
  expect(oversized.statusCode).toBe(413)
  await app.close()
})
