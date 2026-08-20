import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createApp } from '../app.js'
import type { AuthGuard } from '../auth.js'
import type { ServerConfig } from '../config.js'
import type { RecurringRuleRepository } from '../recurring/repository.js'

const userId = 'user-1'
const walletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'
const categoryId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef124'
const labelId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef125'
const ruleId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef126'
const jobSecret = 'recurring-job-secret-that-is-long-enough'

const config: ServerConfig = {
  databaseUrl: 'postgres://unused', frontendOrigin: 'http://localhost:5173', host: '127.0.0.1',
  neonAuthUrl: 'https://auth.test/neondb/auth', port: 8000, recurringJobSecret: jobSecret,
}

const rule = {
  id: ruleId, name: 'Nájem', kind: 'transaction' as const, amountCzk: 18000,
  walletId, walletName: 'AirBank', categoryId, categoryName: 'Domov', categoryIconKey: 'house',
  categoryColorKey: 'orange', categoryDirection: 'expense' as const,
  sourceWalletId: null, sourceWalletName: null, destinationWalletId: null, destinationWalletName: null,
  note: 'Každý měsíc', labels: [{ id: labelId, name: 'bydlení' }], frequency: 'monthly' as const,
  customIntervalDays: null, nextOccurrenceDate: '2099-08-18', endsOn: null, status: 'active' as const,
}

function createRepository(): RecurringRuleRepository {
  return {
    listRules: vi.fn().mockResolvedValue([rule]),
    createRule: vi.fn().mockResolvedValue(rule),
    updateRule: vi.fn().mockResolvedValue(rule),
    deleteRule: vi.fn().mockResolvedValue(true),
    generateDue: vi.fn().mockResolvedValue({ processedRules: 1, generatedTransactions: 1, generatedTransfers: 0 }),
  }
}

const requireTestAuth: AuthGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.headers.authorization !== 'Bearer test-token') return reply.code(401).send({ error: 'Unauthorized' })
  request.authUser = { id: userId }
}

async function createTestApp(repository = createRepository()) {
  const app = await createApp({
    config,
    database: { end: vi.fn() } as unknown as Pool,
    recurringRuleRepository: repository,
    requireAuth: requireTestAuth,
  })
  return { app, repository }
}

function transactionRulePayload() {
  return {
    name: '  Nájem  ', kind: 'transaction', amountCzk: 18000, walletId, categoryId,
    note: '  Každý měsíc  ', labelIds: [labelId], frequency: 'monthly', customIntervalDays: null,
    nextOccurrenceDate: '2099-08-18', endsOn: null,
  }
}

test('lists recurring rules only for the verified user', async () => {
  const { app, repository } = await createTestApp()
  const response = await app.inject({ method: 'GET', url: '/api/recurring-rules', headers: { authorization: 'Bearer test-token' } })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual([rule])
  expect(repository.listRules).toHaveBeenCalledWith(userId)
  await app.close()
})

test('creates, replaces, and deletes a recurring rule for the verified user', async () => {
  const { app, repository } = await createTestApp()
  const created = await app.inject({ method: 'POST', url: '/api/recurring-rules', headers: { authorization: 'Bearer test-token' }, payload: transactionRulePayload() })
  expect(created.statusCode).toBe(201)
  expect(repository.createRule).toHaveBeenCalledWith(
    userId,
    expect.objectContaining({ name: 'Nájem', note: 'Každý měsíc', nextOccurrenceDate: '2099-08-18' }),
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  )

  const updated = await app.inject({ method: 'PATCH', url: `/api/recurring-rules/${ruleId}`, headers: { authorization: 'Bearer test-token' }, payload: transactionRulePayload() })
  expect(updated.statusCode).toBe(200)
  expect(repository.updateRule).toHaveBeenCalledWith(
    userId,
    ruleId,
    expect.objectContaining({ kind: 'transaction', walletId, categoryId }),
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  )

  const deleted = await app.inject({ method: 'DELETE', url: `/api/recurring-rules/${ruleId}`, headers: { authorization: 'Bearer test-token' } })
  expect(deleted.statusCode).toBe(204)
  expect(repository.deleteRule).toHaveBeenCalledWith(userId, ruleId)
  await app.close()
})

test('rejects anonymous and malformed recurring rule requests', async () => {
  const { app, repository } = await createTestApp()
  const anonymous = await app.inject({ method: 'POST', url: '/api/recurring-rules', payload: transactionRulePayload() })
  expect(anonymous.statusCode).toBe(401)

  const malformed = await app.inject({ method: 'POST', url: '/api/recurring-rules', headers: { authorization: 'Bearer test-token' }, payload: { ...transactionRulePayload(), nextOccurrenceDate: '2000-01-01' } })
  expect(malformed.statusCode).toBe(400)

  const invalidEnd = await app.inject({ method: 'POST', url: '/api/recurring-rules', headers: { authorization: 'Bearer test-token' }, payload: { ...transactionRulePayload(), nextOccurrenceDate: '2099-08-18', endsOn: '2099-08-17' } })
  expect(invalidEnd.statusCode).toBe(400)

  expect(repository.createRule).not.toHaveBeenCalled()
  await app.close()
})

test('runs recurring generation only with the internal job secret', async () => {
  const { app, repository } = await createTestApp()
  expect((await app.inject({ method: 'POST', url: '/internal/jobs/recurring' })).statusCode).toBe(401)
  expect((await app.inject({ method: 'POST', url: '/internal/jobs/recurring', headers: { 'x-cashdeck-job-secret': 'wrong' } })).statusCode).toBe(401)

  const response = await app.inject({ method: 'POST', url: '/internal/jobs/recurring', headers: { 'x-cashdeck-job-secret': jobSecret } })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ processedRules: 1, generatedTransactions: 1, generatedTransfers: 0 })
  expect(repository.generateDue).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  await app.close()
})
