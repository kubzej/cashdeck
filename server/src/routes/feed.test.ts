import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createApp } from '../app.js'
import type { AuthGuard } from '../auth.js'
import type { ServerConfig } from '../config.js'
import type { FeedRepository } from '../feed/repository.js'

const userId = 'user-1'
const walletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'

const config: ServerConfig = { databaseUrl: 'postgres://unused', frontendOrigin: 'http://localhost:5173', host: '127.0.0.1', neonAuthUrl: 'https://auth.test/neondb/auth', port: 8000, sessionSigningSecret: 'test-session-signing-secret-32-characters-long', appAccessPassphrase: 'test-passphrase', appUserId: 'test-user-id' }

function createRepository(): FeedRepository {
  return {
    listFeed: vi.fn().mockResolvedValue({
      items: [{ kind: 'transaction', id: 'c00f7a6a-d0c1-4f08-9bd4-643415bef124', walletId, walletName: 'AirBank', categoryId: 'c00f7a6a-d0c1-4f08-9bd4-643415bef125', categoryName: 'Jídlo', categoryIconKey: 'utensils', categoryColorKey: 'orange', direction: 'expense', amountCzk: 250, transactionDate: '2026-08-20', note: null, labels: [] }],
      nextCursor: null,
    }),
    getBounds: vi.fn().mockResolvedValue({ earliestActivityDate: '2020-01-01' }),
  }
}

const requireTestAuth: AuthGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.headers.authorization !== 'Bearer test-token') return reply.code(401).send({ error: 'Unauthorized' })
  request.authUser = { id: userId }
}

async function createTestApp(repository = createRepository()) {
  const app = await createApp({ config, database: { end: vi.fn() } as unknown as Pool, feedRepository: repository, requireAuth: requireTestAuth })
  return { app, repository }
}

test('reads one paginated feed scoped to the verified user', async () => {
  const { app, repository } = await createTestApp()
  const response = await app.inject({ method: 'GET', url: `/api/feed?walletIds=${walletId}&dateFrom=2026-08-01&dateTo=2026-08-31&search=%20J%C3%ADdlo%20&limit=25`, headers: { authorization: 'Bearer test-token' } })
  expect(response.statusCode).toBe(200)
  expect(response.json().items[0]).toMatchObject({ kind: 'transaction', categoryName: 'Jídlo' })
  expect(repository.listFeed).toHaveBeenCalledWith(userId, { walletIds: [walletId], dateFrom: '2026-08-01', dateTo: '2026-08-31', search: 'Jídlo', cursor: null, limit: 25 })
  await app.close()
})

test('rejects invalid filters and anonymous feed reads', async () => {
  const { app, repository } = await createTestApp()
  const invalid = await app.inject({ method: 'GET', url: '/api/feed?dateFrom=2026-08-31&dateTo=2026-08-01', headers: { authorization: 'Bearer test-token' } })
  expect(invalid.statusCode).toBe(400)
  expect(repository.listFeed).not.toHaveBeenCalled()

  const duplicateWallet = await app.inject({ method: 'GET', url: `/api/feed?walletIds=${walletId},${walletId}`, headers: { authorization: 'Bearer test-token' } })
  expect(duplicateWallet.statusCode).toBe(400)

  const anonymous = await app.inject({ method: 'GET', url: '/api/feed' })
  expect(anonymous.statusCode).toBe(401)
  await app.close()
})

test('reads the earliest visible activity for the selected wallets', async () => {
  const { app, repository } = await createTestApp()
  const response = await app.inject({ method: 'GET', url: `/api/feed/bounds?walletIds=${walletId}`, headers: { authorization: 'Bearer test-token' } })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ earliestActivityDate: '2020-01-01' })
  expect(repository.getBounds).toHaveBeenCalledWith(userId, { walletIds: [walletId] })
  await app.close()
})
