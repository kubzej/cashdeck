import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createApp } from '../app.js'
import type { AuthGuard } from '../auth.js'
import type { ServerConfig } from '../config.js'
import type { PlannedRepository } from '../planned/repository.js'

const userId = 'user-1'
const walletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'
const categoryId = 'f2b30da3-819e-4eb1-bfbd-5bea6760624d'
const labelId = '23ceac7e-cba7-4d8c-8559-0a162fb544c2'
const config: ServerConfig = { databaseUrl: 'postgres://unused', frontendOrigin: 'http://localhost:5173', host: '127.0.0.1', neonAuthUrl: 'https://auth.test/neondb/auth', port: 8000, sessionSigningSecret: 'test-session-signing-secret-32-characters-long', appAccessPassphrase: 'test-passphrase', appUserId: 'test-user-id' }

function createRepository(): PlannedRepository {
  return { listPlanned: vi.fn().mockResolvedValue({ items: [], summary: { count: 0, totalCzk: 0 } }) }
}

const requireTestAuth: AuthGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.headers.authorization !== 'Bearer test-token') return reply.code(401).send({ error: 'Unauthorized' })
  request.authUser = { id: userId }
}

test('reads planned data within a bounded future interval for the verified user', async () => {
  const repository = createRepository()
  const app = await createApp({ config, database: { end: vi.fn() } as unknown as Pool, plannedRepository: repository, requireAuth: requireTestAuth })
  const response = await app.inject({ method: 'GET', url: `/api/planned?walletIds=${walletId}&dateFrom=2026-08-21&dateTo=2026-08-31`, headers: { authorization: 'Bearer test-token' } })
  expect(response.statusCode).toBe(200)
  expect(repository.listPlanned).toHaveBeenCalledWith(userId, { walletIds: [walletId], dateFrom: '2026-08-21', dateTo: '2026-08-31' })
  await app.close()
})

test('forwards exact category and label filters to planned calculations', async () => {
  const repository = createRepository()
  const app = await createApp({ config, database: { end: vi.fn() } as unknown as Pool, plannedRepository: repository, requireAuth: requireTestAuth })
  const response = await app.inject({ method: 'GET', url: `/api/planned?walletIds=${walletId}&dateFrom=2026-08-21&dateTo=2026-08-31&categoryId=${categoryId}&labelId=${labelId}`, headers: { authorization: 'Bearer test-token' } })
  expect(response.statusCode).toBe(200)
  expect(repository.listPlanned).toHaveBeenCalledWith(userId, { walletIds: [walletId], dateFrom: '2026-08-21', dateTo: '2026-08-31', categoryId, labelId })
  await app.close()
})

test('rejects anonymous and invalid planned data requests', async () => {
  const repository = createRepository()
  const app = await createApp({ config, database: { end: vi.fn() } as unknown as Pool, plannedRepository: repository, requireAuth: requireTestAuth })
  expect((await app.inject({ method: 'GET', url: '/api/planned?dateFrom=2026-08-31&dateTo=2026-08-01', headers: { authorization: 'Bearer test-token' } })).statusCode).toBe(400)
  expect((await app.inject({ method: 'GET', url: '/api/planned?dateFrom=2026-08-21&dateTo=2026-08-31' })).statusCode).toBe(401)
  expect(repository.listPlanned).not.toHaveBeenCalled()
  await app.close()
})
