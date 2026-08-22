import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createApp } from '../app.js'
import type { AuthGuard } from '../auth.js'
import type { ServerConfig } from '../config.js'
import type { OverviewRepository } from '../overview/repository.js'

const userId = 'user-1'
const walletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'
const config: ServerConfig = { databaseUrl: 'postgres://unused', frontendOrigin: 'http://localhost:5173', host: '127.0.0.1', neonAuthUrl: 'https://auth.test/neondb/auth', port: 8000, sessionSigningSecret: 'test-session-signing-secret-32-characters-long', appAccessPassphrase: 'test-passphrase', appUserId: 'test-user-id' }

const requireTestAuth: AuthGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.headers.authorization !== 'Bearer test-token') return reply.code(401).send({ error: 'Unauthorized' })
  request.authUser = { id: userId }
}

function createRepository(): OverviewRepository {
  return {
    getOverview: vi.fn().mockResolvedValue({ range: { dateFrom: '2026-08-01', dateTo: '2026-08-20', earliestActivityDate: '2025-01-01', granularity: 'day' }, wealth: { amountCzk: 150_000, changeCzk: 12_000 }, flow: { incomeCzk: 70_000, expenseCzk: 58_000, cashflowCzk: 12_000 }, wealthSeries: [], flowSeries: [], categories: [], labels: [] }),
    getSelectionTrend: vi.fn().mockResolvedValue({ previous: { amountCzk: -9_000 }, series: [{ date: '2026-08-01', amountCzk: -3_000 }] }),
  }
}

test('reads one bounded overview scoped to the verified user', async () => {
  const repository = createRepository()
  const app = await createApp({ config, database: { end: vi.fn() } as unknown as Pool, overviewRepository: repository, requireAuth: requireTestAuth })
  const response = await app.inject({ method: 'GET', url: `/api/overview?walletIds=${walletId}&period=month&dateFrom=2026-08-01&dateTo=2026-08-31`, headers: { authorization: 'Bearer test-token' } })
  expect(response.statusCode).toBe(200)
  expect(response.json().wealth).toEqual({ amountCzk: 150_000, changeCzk: 12_000 })
  expect(repository.getOverview).toHaveBeenCalledWith(userId, { walletIds: [walletId], period: 'month', dateFrom: '2026-08-01', dateTo: '2026-08-31', search: null })
  await app.close()
})

test('rejects malformed and anonymous overview requests', async () => {
  const repository = createRepository()
  const app = await createApp({ config, database: { end: vi.fn() } as unknown as Pool, overviewRepository: repository, requireAuth: requireTestAuth })
  expect((await app.inject({ method: 'GET', url: '/api/overview?period=month', headers: { authorization: 'Bearer test-token' } })).statusCode).toBe(400)
  expect((await app.inject({ method: 'GET', url: '/api/overview?period=all' })).statusCode).toBe(401)
  expect(repository.getOverview).not.toHaveBeenCalled()
  await app.close()
})

test('reads a bounded selection trend scoped to the verified user', async () => {
  const repository = createRepository()
  const app = await createApp({ config, database: { end: vi.fn() } as unknown as Pool, overviewRepository: repository, requireAuth: requireTestAuth })
  const categoryId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef124'
  const response = await app.inject({ method: 'GET', url: `/api/overview/selection?type=category&id=${categoryId}&walletIds=${walletId}&dateFrom=2026-08-01&dateTo=2026-08-31&granularity=day&search=Oneplay`, headers: { authorization: 'Bearer test-token' } })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ previous: { amountCzk: -9_000 }, series: [{ date: '2026-08-01', amountCzk: -3_000 }] })
  expect(repository.getSelectionTrend).toHaveBeenCalledWith(userId, { type: 'category', id: categoryId, walletIds: [walletId], dateFrom: '2026-08-01', dateTo: '2026-08-31', granularity: 'day', search: 'Oneplay' })
  await app.close()
})

test('rejects malformed and anonymous selection trend requests', async () => {
  const repository = createRepository()
  const app = await createApp({ config, database: { end: vi.fn() } as unknown as Pool, overviewRepository: repository, requireAuth: requireTestAuth })
  expect((await app.inject({ method: 'GET', url: '/api/overview/selection?type=invalid&id=x&dateFrom=2026-08-01&dateTo=2026-08-31&granularity=day', headers: { authorization: 'Bearer test-token' } })).statusCode).toBe(400)
  expect((await app.inject({ method: 'GET', url: '/api/overview/selection?type=category&id=c00f7a6a-d0c1-4f08-9bd4-643415bef124&dateFrom=2026-08-01&dateTo=2026-08-31&granularity=day' })).statusCode).toBe(401)
  expect(repository.getSelectionTrend).not.toHaveBeenCalled()
  await app.close()
})
