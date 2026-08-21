import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createApp } from '../app.js'
import type { AuthGuard } from '../auth.js'
import type { ServerConfig } from '../config.js'
import type { IndependenceRepository } from '../independence/repository.js'

const userId = 'user-1'
const config: ServerConfig = { databaseUrl: 'postgres://unused', frontendOrigin: 'http://localhost:5173', host: '127.0.0.1', neonAuthUrl: 'https://auth.test/neondb/auth', port: 8000, sessionSigningSecret: 'test-session-signing-secret-32-characters-long', appAccessPassphrase: 'test-passphrase', appUserId: 'test-user-id' }

const requireTestAuth: AuthGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.headers.authorization !== 'Bearer test-token') return reply.code(401).send({ error: 'Unauthorized' })
  request.authUser = { id: userId }
}

function createRepository(): IndependenceRepository {
  return {
    getSettings: vi.fn().mockResolvedValue(null),
    upsertSettings: vi.fn().mockResolvedValue({ withdrawalRatePercent: 4, expectedRealReturnPercent: 4, inflationRatePercent: 2.5, monthlyContributionCzk: 0, housingMonthlyCzk: 0, foodMonthlyCzk: 0, transportMonthlyCzk: 0, healthMonthlyCzk: 0, leisureMonthlyCzk: 0, clothingMonthlyCzk: 0, familyMonthlyCzk: 0, reserveMonthlyCzk: 0 }),
    listIrregularExpenses: vi.fn().mockResolvedValue([]),
    createIrregularExpense: vi.fn().mockResolvedValue({ id: 'irregular-1', name: 'Auto', amountCzk: 400_000, frequencyYears: 8, sortOrder: 0 }),
    updateIrregularExpense: vi.fn().mockResolvedValue({ id: 'irregular-1', name: 'Auto', amountCzk: 450_000, frequencyYears: 8, sortOrder: 0 }),
    deleteIrregularExpense: vi.fn().mockResolvedValue(true),
    getProgress: vi.fn().mockResolvedValue({ hasSettings: false, annualExpensesCzk: 0, independenceNumberCzk: 0, totalWealthCzk: 0, availableWealthCzk: 0, totalProgressPercent: 0, availableProgressPercent: 0, yearsToTotal: null, yearsToAvailable: null, futureAnnualExpensesCzk: null }),
    getWealthSeries: vi.fn().mockResolvedValue([{ date: '2026-08-01', amountCzk: 100_000 }]),
  }
}

async function createTestApp(repository = createRepository()) {
  const app = await createApp({ config, database: { end: vi.fn() } as unknown as Pool, independenceRepository: repository, requireAuth: requireTestAuth })
  return { app, repository }
}

test('protects independence routes and scopes them to the verified user', async () => {
  const { app, repository } = await createTestApp()

  const unauthorized = await app.inject({ method: 'GET', url: '/api/independence/progress' })
  expect(unauthorized.statusCode).toBe(401)

  const response = await app.inject({ method: 'GET', url: '/api/independence/progress', headers: { authorization: 'Bearer test-token' } })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ hasSettings: false, annualExpensesCzk: 0, independenceNumberCzk: 0, totalWealthCzk: 0, availableWealthCzk: 0, totalProgressPercent: 0, availableProgressPercent: 0, yearsToTotal: null, yearsToAvailable: null, futureAnnualExpensesCzk: null })
  expect(repository.getProgress).toHaveBeenCalledWith(userId)
  await app.close()
})

test('reads the wealth series scoped to the verified user', async () => {
  const { app, repository } = await createTestApp()

  const response = await app.inject({ method: 'GET', url: '/api/independence/wealth-series', headers: { authorization: 'Bearer test-token' } })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ points: [{ date: '2026-08-01', amountCzk: 100_000 }] })
  expect(repository.getWealthSeries).toHaveBeenCalledWith(userId)
  await app.close()
})

test('validates and saves independence settings', async () => {
  const { app, repository } = await createTestApp()

  const invalid = await app.inject({
    method: 'PUT',
    url: '/api/independence/settings',
    headers: { authorization: 'Bearer test-token' },
    payload: { withdrawalRatePercent: 4, expectedRealReturnPercent: 4, inflationRatePercent: 2.5, monthlyContributionCzk: -1, housingMonthlyCzk: 0, foodMonthlyCzk: 0, transportMonthlyCzk: 0, healthMonthlyCzk: 0, leisureMonthlyCzk: 0, clothingMonthlyCzk: 0, familyMonthlyCzk: 0, reserveMonthlyCzk: 0 },
  })
  expect(invalid.statusCode).toBe(400)
  expect(repository.upsertSettings).not.toHaveBeenCalled()

  const valid = await app.inject({
    method: 'PUT',
    url: '/api/independence/settings',
    headers: { authorization: 'Bearer test-token' },
    payload: { withdrawalRatePercent: 4, expectedRealReturnPercent: 4, inflationRatePercent: 2.5, monthlyContributionCzk: 5_000, housingMonthlyCzk: 15_000, foodMonthlyCzk: 8_000, transportMonthlyCzk: 2_000, healthMonthlyCzk: 1_500, leisureMonthlyCzk: 4_000, clothingMonthlyCzk: 1_000, familyMonthlyCzk: 0, reserveMonthlyCzk: 2_000 },
  })
  expect(valid.statusCode).toBe(200)
  expect(repository.upsertSettings).toHaveBeenCalledWith(userId, expect.objectContaining({ withdrawalRatePercent: 4 }))
  await app.close()
})

test('rejects an irregular expense with a non-positive amount or frequency, and creates a valid one', async () => {
  const { app, repository } = await createTestApp()

  const invalidAmount = await app.inject({ method: 'POST', url: '/api/independence/irregular-expenses', headers: { authorization: 'Bearer test-token' }, payload: { name: 'Auto', amountCzk: 0, frequencyYears: 8 } })
  expect(invalidAmount.statusCode).toBe(400)

  const invalidFrequency = await app.inject({ method: 'POST', url: '/api/independence/irregular-expenses', headers: { authorization: 'Bearer test-token' }, payload: { name: 'Auto', amountCzk: 400_000, frequencyYears: 0 } })
  expect(invalidFrequency.statusCode).toBe(400)
  expect(repository.createIrregularExpense).not.toHaveBeenCalled()

  const created = await app.inject({ method: 'POST', url: '/api/independence/irregular-expenses', headers: { authorization: 'Bearer test-token' }, payload: { name: 'Auto', amountCzk: 400_000, frequencyYears: 8 } })
  expect(created.statusCode).toBe(201)
  expect(repository.createIrregularExpense).toHaveBeenCalledWith(userId, { name: 'Auto', amountCzk: 400_000, frequencyYears: 8 })
  await app.close()
})

test('returns 404 when updating or deleting an irregular expense that does not belong to the user', async () => {
  const repository = createRepository()
  repository.updateIrregularExpense = vi.fn().mockResolvedValue(null)
  repository.deleteIrregularExpense = vi.fn().mockResolvedValue(false)
  const { app } = await createTestApp(repository)

  const update = await app.inject({ method: 'PATCH', url: '/api/independence/irregular-expenses/c00f7a6a-d0c1-4f08-9bd4-643415bef123', headers: { authorization: 'Bearer test-token' }, payload: { amountCzk: 450_000 } })
  expect(update.statusCode).toBe(404)

  const remove = await app.inject({ method: 'DELETE', url: '/api/independence/irregular-expenses/c00f7a6a-d0c1-4f08-9bd4-643415bef123', headers: { authorization: 'Bearer test-token' } })
  expect(remove.statusCode).toBe(404)
  await app.close()
})
