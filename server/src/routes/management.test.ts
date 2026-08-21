import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createApp } from '../app.js'
import type { AuthGuard } from '../auth.js'
import type { ServerConfig } from '../config.js'
import { DomainError } from '../management/domain.js'
import type { ManagementRepository } from '../management/repository.js'

const userId = 'user-1'
const walletId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef123'
const categoryId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef124'
const labelId = 'c00f7a6a-d0c1-4f08-9bd4-643415bef125'

const config: ServerConfig = {
  databaseUrl: 'postgres://unused',
  frontendOrigin: 'http://localhost:5173',
  host: '127.0.0.1',
  neonAuthUrl: 'https://auth.test/neondb/auth',
  port: 8000,
}

function createRepository(): ManagementRepository {
  return {
    listWallets: vi.fn().mockResolvedValue([]),
    getWallet: vi.fn().mockResolvedValue(null),
    createWallet: vi.fn().mockResolvedValue({ id: walletId, name: 'AirBank' }),
    updateWallet: vi.fn().mockResolvedValue(null),
    reorderWallets: vi.fn().mockResolvedValue(undefined),
    deleteWallet: vi.fn().mockResolvedValue(false),
    createBalanceAdjustment: vi.fn().mockResolvedValue(null),
    listCategories: vi.fn().mockResolvedValue([]),
    createCategory: vi.fn().mockResolvedValue({ id: categoryId, name: 'Restaurace', direction: 'expense' }),
    updateCategory: vi.fn().mockResolvedValue(null),
    reorderCategories: vi.fn().mockResolvedValue(undefined),
    deleteCategory: vi.fn().mockResolvedValue(false),
    listLabels: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    createLabel: vi.fn().mockResolvedValue({ id: labelId, name: 'globus' }),
    updateLabel: vi.fn().mockResolvedValue(null),
    deleteLabel: vi.fn().mockResolvedValue(false),
  }
}

const requireTestAuth: AuthGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.headers.authorization !== 'Bearer test-token') {
    return reply.code(401).send({ error: 'Unauthorized' })
  }

  request.authUser = { id: userId }
}

async function createTestApp(repository = createRepository()) {
  const app = await createApp({
    config,
    database: { end: vi.fn() } as unknown as Pool,
    managementRepository: repository,
    requireAuth: requireTestAuth,
  })
  return { app, repository }
}

test('protects management routes and scopes them to the verified user', async () => {
  const { app, repository } = await createTestApp()

  const unauthorized = await app.inject({ method: 'GET', url: '/api/wallets' })
  expect(unauthorized.statusCode).toBe(401)

  const response = await app.inject({
    method: 'GET',
    url: '/api/wallets',
    headers: { authorization: 'Bearer test-token' },
  })

  expect(response.statusCode).toBe(200)
  expect(repository.listWallets).toHaveBeenCalledWith(userId, false)
  await app.close()
})

test('returns the current wallet balance alongside its opening balance', async () => {
  const { app, repository } = await createTestApp()
  repository.listWallets.mockResolvedValueOnce([{
    id: walletId,
    name: 'Běžný účet',
    colorKey: 'teal',
    openingBalanceCzk: 78000,
    currentBalanceCzk: 123456,
    openingBalanceDate: '2026-01-01',
    sortOrder: 0,
    isHidden: false,
    openingBalanceLocked: true,
  }])

  const response = await app.inject({
    method: 'GET',
    url: '/api/wallets',
    headers: { authorization: 'Bearer test-token' },
  })

  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({
    items: [expect.objectContaining({
      id: walletId,
      openingBalanceCzk: 78000,
      currentBalanceCzk: 123456,
    })],
  })
  await app.close()
})

test('normalizes category and label writes before they reach the repository', async () => {
  const { app, repository } = await createTestApp()

  const categoryResponse = await app.inject({
    method: 'POST',
    url: '/api/categories',
    headers: { authorization: 'Bearer test-token' },
    payload: { name: '  restaurace ', direction: 'expense', iconKey: 'utensils', colorKey: 'orange' },
  })
  expect(categoryResponse.statusCode).toBe(201)
  expect(repository.createCategory).toHaveBeenCalledWith(userId, {
    name: 'Restaurace',
    direction: 'expense',
    iconKey: 'utensils',
    colorKey: 'orange',
  })

  const labelResponse = await app.inject({
    method: 'POST',
    url: '/api/labels',
    headers: { authorization: 'Bearer test-token' },
    payload: { name: '  FoundationGalaxy ' },
  })
  expect(labelResponse.statusCode).toBe(201)
  expect(repository.createLabel).toHaveBeenCalledWith(userId, 'foundationgalaxy')

  repository.updateLabel.mockResolvedValueOnce({ id: labelId, name: 'globus' })
  const updatedLabel = await app.inject({
    method: 'PATCH',
    url: `/api/labels/${labelId}`,
    headers: { authorization: 'Bearer test-token' },
    payload: { name: '  Globus ' },
  })
  expect(updatedLabel.statusCode).toBe(200)
  expect(repository.updateLabel).toHaveBeenCalledWith(userId, labelId, 'globus')

  repository.deleteLabel.mockResolvedValueOnce(true)
  const deletedLabel = await app.inject({
    method: 'DELETE',
    url: `/api/labels/${labelId}`,
    headers: { authorization: 'Bearer test-token' },
  })
  expect(deletedLabel.statusCode).toBe(204)
  expect(repository.deleteLabel).toHaveBeenCalledWith(userId, labelId)
  await app.close()
})

test('validates and scopes wallet writes to the verified user', async () => {
  const { app, repository } = await createTestApp()
  repository.createWallet.mockResolvedValueOnce({ id: walletId, name: 'AirBank' })
  repository.updateWallet.mockResolvedValueOnce({ id: walletId, name: 'AirBank' })
  repository.deleteWallet.mockResolvedValueOnce(true)

  const created = await app.inject({
    method: 'POST',
    url: '/api/wallets',
    headers: { authorization: 'Bearer test-token' },
    payload: {
      name: '  AirBank  ',
      colorKey: 'teal',
      openingBalanceCzk: 150000,
      openingBalanceDate: '2022-01-15',
    },
  })
  expect(created.statusCode).toBe(201)
  expect(repository.createWallet).toHaveBeenCalledWith(userId, {
    name: 'AirBank',
    colorKey: 'teal',
    openingBalanceCzk: 150000,
    openingBalanceDate: '2022-01-15',
  })

  const updated = await app.inject({
    method: 'PATCH',
    url: `/api/wallets/${walletId}`,
    headers: { authorization: 'Bearer test-token' },
    payload: {
      name: '  Rezerva  ',
      colorKey: 'red',
      openingBalanceCzk: 250000,
      openingBalanceDate: '2022-02-01',
    },
  })
  expect(updated.statusCode).toBe(200)
  expect(repository.updateWallet).toHaveBeenCalledWith(userId, walletId, {
    name: 'Rezerva',
    colorKey: 'red',
    openingBalanceCzk: 250000,
    openingBalanceDate: '2022-02-01',
  })

  const reordered = await app.inject({
    method: 'PUT',
    url: '/api/wallets/order',
    headers: { authorization: 'Bearer test-token' },
    payload: { walletIds: [walletId] },
  })
  expect(reordered.statusCode).toBe(204)
  expect(repository.reorderWallets).toHaveBeenCalledWith(userId, [walletId])

  const deleted = await app.inject({
    method: 'DELETE',
    url: `/api/wallets/${walletId}`,
    headers: { authorization: 'Bearer test-token' },
  })
  expect(deleted.statusCode).toBe(204)
  expect(repository.deleteWallet).toHaveBeenCalledWith(userId, walletId)
  await app.close()
})

test('creates a balance adjustment from the actual wallet balance without creating a transaction', async () => {
  const { app, repository } = await createTestApp()
  repository.createBalanceAdjustment.mockResolvedValueOnce({
    adjustment: {
      id: 'c00f7a6a-d0c1-4f08-9bd4-643415bef126',
      walletId,
      amountCzk: 1544,
      operation: 'add',
      adjustmentDate: '2026-08-21',
    },
    currentBalanceCzk: 125000,
  })

  const created = await app.inject({
    method: 'POST',
    url: `/api/wallets/${walletId}/balance-adjustments`,
    headers: { authorization: 'Bearer test-token' },
    payload: { actualBalanceCzk: 125000 },
  })

  expect(created.statusCode).toBe(201)
  expect(repository.createBalanceAdjustment).toHaveBeenCalledWith(userId, walletId, 125000)
  expect(created.json()).toEqual(expect.objectContaining({ currentBalanceCzk: 125000, adjustment: expect.objectContaining({ operation: 'add', amountCzk: 1544 }) }))

  repository.createBalanceAdjustment.mockResolvedValueOnce({ adjustment: null, currentBalanceCzk: 125000 })
  const unchanged = await app.inject({
    method: 'POST',
    url: `/api/wallets/${walletId}/balance-adjustments`,
    headers: { authorization: 'Bearer test-token' },
    payload: { actualBalanceCzk: 125000 },
  })
  expect(unchanged.statusCode).toBe(200)
  expect(unchanged.json()).toEqual({ adjustment: null, currentBalanceCzk: 125000 })
  await app.close()
})

test('rejects invalid balance adjustments before they reach the repository', async () => {
  const { app, repository } = await createTestApp()

  const decimal = await app.inject({
    method: 'POST',
    url: `/api/wallets/${walletId}/balance-adjustments`,
    headers: { authorization: 'Bearer test-token' },
    payload: { actualBalanceCzk: 125000.5 },
  })
  expect(decimal.statusCode).toBe(400)

  const extraField = await app.inject({
    method: 'POST',
    url: `/api/wallets/${walletId}/balance-adjustments`,
    headers: { authorization: 'Bearer test-token' },
    payload: { actualBalanceCzk: 125000, note: 'nepovolené' },
  })
  expect(extraField.statusCode).toBe(400)
  expect(repository.createBalanceAdjustment).not.toHaveBeenCalled()
  await app.close()
})

test('rejects invalid wallet payloads before they reach the repository', async () => {
  const { app, repository } = await createTestApp()

  const invalidAmount = await app.inject({
    method: 'POST',
    url: '/api/wallets',
    headers: { authorization: 'Bearer test-token' },
    payload: {
      name: 'Rezerva',
      colorKey: 'teal',
      openingBalanceCzk: 1500.5,
      openingBalanceDate: '2022-01-15',
    },
  })
  expect(invalidAmount.statusCode).toBe(400)

  const invalidDate = await app.inject({
    method: 'PATCH',
    url: `/api/wallets/${walletId}`,
    headers: { authorization: 'Bearer test-token' },
    payload: { openingBalanceDate: '15.01.2022' },
  })
  expect(invalidDate.statusCode).toBe(400)
  expect(repository.createWallet).not.toHaveBeenCalled()
  expect(repository.updateWallet).not.toHaveBeenCalled()
  await app.close()
})

test('rejects category direction changes and maps lifecycle and opening-date conflicts', async () => {
  const { app, repository } = await createTestApp()

  const invalidUpdate = await app.inject({
    method: 'PATCH',
    url: `/api/categories/${categoryId}`,
    headers: { authorization: 'Bearer test-token' },
    payload: { direction: 'income' },
  })
  expect(invalidUpdate.statusCode).toBe(400)
  expect(repository.updateCategory).not.toHaveBeenCalled()

  repository.deleteWallet.mockRejectedValueOnce({ code: '23503', constraint: 'transactions_wallet_same_user_fkey' })
  const conflict = await app.inject({
    method: 'DELETE',
    url: `/api/wallets/${walletId}`,
    headers: { authorization: 'Bearer test-token' },
  })
  expect(conflict.statusCode).toBe(409)
  expect(conflict.json()).toEqual({ error: 'Peněženku nelze smazat, obsahuje transakce.' })

  repository.deleteWallet.mockRejectedValueOnce({ code: '23503' })
  const unknownConflict = await app.inject({
    method: 'DELETE',
    url: `/api/wallets/${walletId}`,
    headers: { authorization: 'Bearer test-token' },
  })
  expect(unknownConflict.statusCode).toBe(409)
  expect(unknownConflict.json()).toEqual({ error: 'Tuto položku nelze smazat, je stále používaná.' })

  repository.updateWallet.mockRejectedValueOnce({
    code: 'P0001',
    message: 'Wallet opening balance cannot change after linked financial records exist',
  })
  const openingDateConflict = await app.inject({
    method: 'PATCH',
    url: `/api/wallets/${walletId}`,
    headers: { authorization: 'Bearer test-token' },
    payload: { openingBalanceDate: '2026-08-20' },
  })
  expect(openingDateConflict.statusCode).toBe(409)
  expect(openingDateConflict.json()).toEqual({ error: 'Počáteční zůstatek nelze změnit, peněženka už má pohyby.' })

  repository.createWallet.mockRejectedValueOnce({ code: '23505', constraint: 'wallets_user_id_normalized_name_unique' })
  const duplicateName = await app.inject({
    method: 'POST',
    url: '/api/wallets',
    headers: { authorization: 'Bearer test-token' },
    payload: { name: 'Běžný účet', colorKey: 'blue', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01' },
  })
  expect(duplicateName.statusCode).toBe(409)
  expect(duplicateName.json()).toEqual({ error: 'Peněženka s tímto názvem už existuje.' })
  await app.close()
})

test('rejects a client-supplied userId instead of silently ignoring it, and never scopes a write by it', async () => {
  const { app, repository } = await createTestApp()

  const response = await app.inject({
    method: 'POST',
    url: '/api/wallets',
    headers: { authorization: 'Bearer test-token' },
    payload: { userId: 'someone-elses-account', name: 'AirBank', colorKey: 'teal', openingBalanceCzk: 0, openingBalanceDate: '2026-01-01' },
  })

  expect(response.statusCode).toBe(400)
  expect(response.json()).toEqual({ error: 'Pole userId není podporované.' })
  expect(repository.createWallet).not.toHaveBeenCalled()
  await app.close()
})

test('rejects reordering wallets with a stale or incomplete id set', async () => {
  const { app, repository } = await createTestApp()
  repository.reorderWallets.mockRejectedValueOnce(new DomainError(409, 'Pořadí peněženek neodpovídá aktuálním datům.'))

  const response = await app.inject({
    method: 'PUT',
    url: '/api/wallets/order',
    headers: { authorization: 'Bearer test-token' },
    payload: { walletIds: [walletId] },
  })
  expect(response.statusCode).toBe(409)
  expect(response.json()).toEqual({ error: 'Pořadí peněženek neodpovídá aktuálním datům.' })
  await app.close()
})

test('uses bounded label search and pagination inputs', async () => {
  const { app, repository } = await createTestApp()

  const response = await app.inject({
    method: 'GET',
    url: '/api/labels?q=  Globus &limit=25',
    headers: { authorization: 'Bearer test-token' },
  })

  expect(response.statusCode).toBe(200)
  expect(repository.listLabels).toHaveBeenCalledWith(userId, 'globus', null, 25, 'alphabetical')
  await app.close()
})

test('can list recently used labels for a transaction form', async () => {
  const { app, repository } = await createTestApp()

  const response = await app.inject({
    method: 'GET',
    url: '/api/labels?sort=recent&limit=8',
    headers: { authorization: 'Bearer test-token' },
  })

  expect(response.statusCode).toBe(200)
  expect(repository.listLabels).toHaveBeenCalledWith(userId, null, null, 8, 'recent')
  await app.close()
})
