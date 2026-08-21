import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createApp } from '../app.js'
import type { AuthGuard } from '../auth.js'
import type { ServerConfig } from '../config.js'
import type { TransferRepository } from '../transfers/repository.js'

const userId = 'user-1'
const sourceWalletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'
const destinationWalletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef124'
const labelId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef125'
const transferId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef126'

const config: ServerConfig = { databaseUrl: 'postgres://unused', frontendOrigin: 'http://localhost:5173', host: '127.0.0.1', neonAuthUrl: 'https://auth.test/neondb/auth', port: 8000 }
const transfer = { id: transferId, sourceWalletId, sourceWalletName: 'AirBank', destinationWalletId, destinationWalletName: 'Rezerva', amountCzk: 2500, transferDate: '2026-08-20', note: 'Přesun', labels: [{ id: labelId, name: 'rezerva' }] }

function createRepository(): TransferRepository {
  return {
    listTransfers: vi.fn().mockResolvedValue({ items: [transfer], nextCursor: null }),
    createTransfer: vi.fn().mockResolvedValue(transfer),
    updateTransfer: vi.fn().mockResolvedValue(transfer),
    deleteTransfer: vi.fn().mockResolvedValue(true),
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
    transferRepository: repository,
    requireAuth: requireTestAuth,
  })
  return { app, repository }
}

test('scopes paginated transfer listing to the verified user', async () => {
  const { app, repository } = await createTestApp()
  const response = await app.inject({ method: 'GET', url: `/api/transfers?walletId=${sourceWalletId}&dateFrom=2026-08-01&dateTo=2026-08-31&limit=25`, headers: { authorization: 'Bearer test-token' } })
  expect(response.statusCode).toBe(200)
  expect(repository.listTransfers).toHaveBeenCalledWith(userId, { walletId: sourceWalletId, dateFrom: '2026-08-01', dateTo: '2026-08-31', cursor: null, limit: 25 })
  await app.close()
})

test('validates complete transfer creation before it reaches the repository', async () => {
  const { app, repository } = await createTestApp()
  const response = await app.inject({
    method: 'POST',
    url: '/api/transfers',
    headers: { authorization: 'Bearer test-token' },
    payload: { sourceWalletId, destinationWalletId, amountCzk: 2500, transferDate: '2026-08-20', note: '  Přesun  ' },
  })
  expect(response.statusCode).toBe(201)
  expect(repository.createTransfer).toHaveBeenCalledWith(userId, { sourceWalletId, destinationWalletId, amountCzk: 2500, transferDate: '2026-08-20', note: 'Přesun', labelIds: [] })
  await app.close()
})

test('updates labels independently and deletes only the verified user transfer', async () => {
  const { app, repository } = await createTestApp()
  const updated = await app.inject({ method: 'PATCH', url: `/api/transfers/${transferId}`, headers: { authorization: 'Bearer test-token' }, payload: { labelIds: [] } })
  expect(updated.statusCode).toBe(200)
  expect(repository.updateTransfer).toHaveBeenCalledWith(userId, transferId, { labelIds: [] })

  const deleted = await app.inject({ method: 'DELETE', url: `/api/transfers/${transferId}`, headers: { authorization: 'Bearer test-token' } })
  expect(deleted.statusCode).toBe(204)
  expect(repository.deleteTransfer).toHaveBeenCalledWith(userId, transferId)
  await app.close()
})

test('rejects self-transfers, zero amounts, duplicate labels, and anonymous writes', async () => {
  const { app, repository } = await createTestApp()
  const selfTransfer = await app.inject({ method: 'POST', url: '/api/transfers', headers: { authorization: 'Bearer test-token' }, payload: { sourceWalletId, destinationWalletId: sourceWalletId, amountCzk: 1, transferDate: '2026-08-20' } })
  expect(selfTransfer.statusCode).toBe(400)

  const zeroAmount = await app.inject({ method: 'POST', url: '/api/transfers', headers: { authorization: 'Bearer test-token' }, payload: { sourceWalletId, destinationWalletId, amountCzk: 0, transferDate: '2026-08-20', note: null, labelIds: [] } })
  expect(zeroAmount.statusCode).toBe(400)

  const duplicateLabels = await app.inject({ method: 'POST', url: '/api/transfers', headers: { authorization: 'Bearer test-token' }, payload: { sourceWalletId, destinationWalletId, amountCzk: 1, transferDate: '2026-08-20', note: null, labelIds: [labelId, labelId] } })
  expect(duplicateLabels.statusCode).toBe(400)

  const anonymous = await app.inject({ method: 'POST', url: '/api/transfers' })
  expect(anonymous.statusCode).toBe(401)
  expect(repository.createTransfer).not.toHaveBeenCalled()
  await app.close()
})
