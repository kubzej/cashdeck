import { Writable } from 'node:stream'
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
  appAccessPassphrase: 'correct horse battery staple',
  appUserId: 'user-123',
}

test('request logs keep the path but never the query string with search text', async () => {
  const lines: string[] = []
  const logStream = new Writable({ write(chunk, _encoding, done) { lines.push(String(chunk)); done() } })
  const app = await createApp({ config, database: { end: vi.fn() } as unknown as Pool, logStream })

  await app.inject({ method: 'GET', url: '/api/feed?search=tajny-obchodnik&walletIds=abc' })
  await app.close()

  const output = lines.join('')
  expect(output).toContain('"url":"/api/feed"')
  expect(output).not.toContain('tajny-obchodnik')
  expect(output).not.toContain('walletIds')
})
