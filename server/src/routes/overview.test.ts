import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createApp } from '../app.js'
import type { AuthGuard } from '../auth.js'
import type { ServerConfig } from '../config.js'
import type { OverviewRepository } from '../overview/repository.js'

const userId = 'user-1'
const walletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'
const config: ServerConfig = { databaseUrl: 'postgres://unused', frontendOrigin: 'http://localhost:5173', host: '127.0.0.1', neonAuthUrl: 'https://auth.test/neondb/auth', port: 8000 }

const requireTestAuth: AuthGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.headers.authorization !== 'Bearer test-token') return reply.code(401).send({ error: 'Unauthorized' })
  request.authUser = { id: userId }
}

function createRepository(): OverviewRepository {
  return { getOverview: vi.fn().mockResolvedValue({ range: { dateFrom: '2026-08-01', dateTo: '2026-08-20', earliestActivityDate: '2025-01-01', granularity: 'day' }, wealth: { amountCzk: 150_000, changeCzk: 12_000 }, flow: { incomeCzk: 70_000, expenseCzk: 58_000, cashflowCzk: 12_000 }, wealthSeries: [], flowSeries: [], categories: [], labels: [] }) }
}

test('reads one bounded overview scoped to the verified user', async () => {
  const repository = createRepository()
  const app = await createApp({ config, database: { end: vi.fn() } as unknown as Pool, overviewRepository: repository, requireAuth: requireTestAuth })
  const response = await app.inject({ method: 'GET', url: `/api/overview?walletIds=${walletId}&period=month&dateFrom=2026-08-01&dateTo=2026-08-31`, headers: { authorization: 'Bearer test-token' } })
  expect(response.statusCode).toBe(200)
  expect(response.json().wealth).toEqual({ amountCzk: 150_000, changeCzk: 12_000 })
  expect(repository.getOverview).toHaveBeenCalledWith(userId, { walletIds: [walletId], period: 'month', dateFrom: '2026-08-01', dateTo: '2026-08-31' })
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
