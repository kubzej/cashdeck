import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createApp } from '../app.js'
import type { AuthGuard } from '../auth.js'
import type { ServerConfig } from '../config.js'
import type { TransactionRepository } from '../transactions/repository.js'

const userId = 'user-1'
const walletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'
const categoryId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef124'
const labelId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef125'
const transactionId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef126'

const config: ServerConfig = {
  databaseUrl: 'postgres://unused',
  frontendOrigin: 'http://localhost:5173',
  host: '127.0.0.1',
  neonAuthUrl: 'https://auth.test/neondb/auth',
  port: 8000,
}

const transaction = {
  id: transactionId,
  walletId,
  walletName: 'AirBank',
  categoryId,
  categoryName: 'Restaurace',
  direction: 'expense' as const,
  amountCzk: 250,
  transactionDate: '2026-08-20',
  note: 'Oběd',
  labels: [{ id: labelId, name: 'globus' }],
}

function createRepository(): TransactionRepository {
  return {
    createTransaction: vi.fn().mockResolvedValue(transaction),
    updateTransaction: vi.fn().mockResolvedValue(transaction),
    deleteTransaction: vi.fn().mockResolvedValue(true),
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
    transactionRepository: repository,
    requireAuth: requireTestAuth,
  })
  return { app, repository }
}

test('validates complete transaction creation before it reaches the repository', async () => {
  const { app, repository } = await createTestApp()
  const response = await app.inject({
    method: 'POST',
    url: '/api/transactions',
    headers: { authorization: 'Bearer test-token' },
    payload: {
      walletId,
      categoryId,
      amountCzk: 250,
      transactionDate: '2026-08-20',
      note: '  Oběd  ',
    },
  })

  expect(response.statusCode).toBe(201)
  expect(repository.createTransaction).toHaveBeenCalledWith(userId, {
    walletId,
    categoryId,
    amountCzk: 250,
    transactionDate: '2026-08-20',
    note: 'Oběd',
    labelIds: [],
  })
  await app.close()
})

test('updates labels independently and deletes only the verified user transaction', async () => {
  const { app, repository } = await createTestApp()
  const updated = await app.inject({
    method: 'PATCH',
    url: `/api/transactions/${transactionId}`,
    headers: { authorization: 'Bearer test-token' },
    payload: { labelIds: [] },
  })
  expect(updated.statusCode).toBe(200)
  expect(repository.updateTransaction).toHaveBeenCalledWith(userId, transactionId, { labelIds: [] })

  const deleted = await app.inject({
    method: 'DELETE',
    url: `/api/transactions/${transactionId}`,
    headers: { authorization: 'Bearer test-token' },
  })
  expect(deleted.statusCode).toBe(204)
  expect(repository.deleteTransaction).toHaveBeenCalledWith(userId, transactionId)
  await app.close()
})

test('rejects zero and negative amounts, duplicate labels, and anonymous writes', async () => {
  const { app, repository } = await createTestApp()
  const zeroAmount = await app.inject({
    method: 'POST',
    url: '/api/transactions',
    headers: { authorization: 'Bearer test-token' },
    payload: { walletId, categoryId, amountCzk: 0, transactionDate: '2026-08-20', note: null, labelIds: [] },
  })
  expect(zeroAmount.statusCode).toBe(400)

  const negativeAmount = await app.inject({
    method: 'POST',
    url: '/api/transactions',
    headers: { authorization: 'Bearer test-token' },
    payload: { walletId, categoryId, amountCzk: -5, transactionDate: '2026-08-20', note: null, labelIds: [] },
  })
  expect(negativeAmount.statusCode).toBe(400)
  expect(repository.createTransaction).not.toHaveBeenCalled()

  const duplicateLabels = await app.inject({
    method: 'POST',
    url: '/api/transactions',
    headers: { authorization: 'Bearer test-token' },
    payload: { walletId, categoryId, amountCzk: 1, transactionDate: '2026-08-20', note: null, labelIds: [labelId, labelId] },
  })
  expect(duplicateLabels.statusCode).toBe(400)

  const anonymous = await app.inject({ method: 'POST', url: '/api/transactions' })
  expect(anonymous.statusCode).toBe(401)
  expect(repository.createTransaction).not.toHaveBeenCalled()
  await app.close()
})
