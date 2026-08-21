import type { FastifyPluginAsync } from 'fastify'
import type { AuthGuard } from '../auth.js'
import {
  asRecord,
  assertOnlyKeys,
  DomainError,
  normalizeCategoryName,
  normalizeLabelName,
  normalizeWalletName,
  parseCalendarDate,
  parseCategoryDirection,
  parseCategoryIconKey,
  parseColorKey,
  parseOptionalBoolean,
  parseUuid,
  parseWalletType,
  parseWholeCzk,
} from '../management/domain.js'
import type {
  CreateCategoryInput,
  CreateWalletInput,
  LabelListSort,
  ManagementRepository,
  UpdateCategoryInput,
  UpdateWalletInput,
} from '../management/repository.js'

export function createManagementRoutes(repository: ManagementRepository, requireAuth: AuthGuard): FastifyPluginAsync {
  return async function managementRoutes(app) {
    app.get('/api/wallets', { preHandler: requireAuth }, async (request) => {
      const query = asRecord(request.query)
      assertOnlyKeys(query, ['includeHidden'])
      const includeHidden = query.includeHidden === undefined ? false : parseOptionalBoolean(query.includeHidden === 'true' ? true : query.includeHidden === 'false' ? false : query.includeHidden, 'includeHidden')
      return { items: await repository.listWallets(request.authUser.id, includeHidden) }
    })

    app.post('/api/wallets', { preHandler: requireAuth }, async (request, reply) => {
      const wallet = await repository.createWallet(request.authUser.id, parseCreateWallet(request.body))
      return reply.code(201).send(wallet)
    })

    app.put('/api/wallets/order', { preHandler: requireAuth }, async (request, reply) => {
      await repository.reorderWallets(request.authUser.id, parseOrder(request.body, 'walletIds'))
      return reply.code(204).send()
    })

    app.get('/api/wallets/:walletId', { preHandler: requireAuth }, async (request) => {
      const walletId = parseUuid((request.params as Record<string, unknown>).walletId, 'ID peněženky')
      const wallet = await repository.getWallet(request.authUser.id, walletId)
      if (!wallet) throw new DomainError(404, 'Peněženka neexistuje.')
      return wallet
    })

    app.patch('/api/wallets/:walletId', { preHandler: requireAuth }, async (request) => {
      const walletId = parseUuid((request.params as Record<string, unknown>).walletId, 'ID peněženky')
      const wallet = await repository.updateWallet(request.authUser.id, walletId, parseUpdateWallet(request.body))
      if (!wallet) throw new DomainError(404, 'Peněženka neexistuje.')
      return wallet
    })

  app.delete('/api/wallets/:walletId', { preHandler: requireAuth }, async (request, reply) => {
      const deleted = await repository.deleteWallet(request.authUser.id, parseUuid((request.params as Record<string, unknown>).walletId, 'ID peněženky'))
      if (!deleted) throw new DomainError(404, 'Peněženka neexistuje.')
    return reply.code(204).send()
  })

  app.post('/api/wallets/:walletId/balance-adjustments', { preHandler: requireAuth }, async (request, reply) => {
    const walletId = parseUuid((request.params as Record<string, unknown>).walletId, 'ID peněženky')
    const result = await repository.createBalanceAdjustment(request.authUser.id, walletId, parseActualBalance(request.body))
    if (!result) throw new DomainError(404, 'Peněženka neexistuje.')
    return reply.code(result.adjustment ? 201 : 200).send(result)
  })

    app.get('/api/categories', { preHandler: requireAuth }, async (request) => ({
      items: await repository.listCategories(request.authUser.id),
    }))

    app.post('/api/categories', { preHandler: requireAuth }, async (request, reply) => {
      const category = await repository.createCategory(request.authUser.id, parseCreateCategory(request.body))
      return reply.code(201).send(category)
    })

    app.put('/api/categories/:direction/order', { preHandler: requireAuth }, async (request, reply) => {
      const direction = parseCategoryDirection((request.params as Record<string, unknown>).direction)
      await repository.reorderCategories(request.authUser.id, direction, parseOrder(request.body, 'categoryIds'))
      return reply.code(204).send()
    })

    app.patch('/api/categories/:categoryId', { preHandler: requireAuth }, async (request) => {
      const categoryId = parseUuid((request.params as Record<string, unknown>).categoryId, 'ID kategorie')
      const category = await repository.updateCategory(request.authUser.id, categoryId, parseUpdateCategory(request.body))
      if (!category) throw new DomainError(404, 'Kategorie neexistuje.')
      return category
    })

    app.delete('/api/categories/:categoryId', { preHandler: requireAuth }, async (request, reply) => {
      const deleted = await repository.deleteCategory(request.authUser.id, parseUuid((request.params as Record<string, unknown>).categoryId, 'ID kategorie'))
      if (!deleted) throw new DomainError(404, 'Kategorie neexistuje.')
      return reply.code(204).send()
    })

    app.get('/api/labels', { preHandler: requireAuth }, async (request) => {
      const { query, cursor, limit, sort } = parseLabelListQuery(request.query)
      return repository.listLabels(request.authUser.id, query, cursor, limit, sort)
    })

    app.post('/api/labels', { preHandler: requireAuth }, async (request, reply) => {
      const label = await repository.createLabel(request.authUser.id, parseLabel(request.body))
      return reply.code(201).send(label)
    })

    app.patch('/api/labels/:labelId', { preHandler: requireAuth }, async (request) => {
      const labelId = parseUuid((request.params as Record<string, unknown>).labelId, 'ID štítku')
      const label = await repository.updateLabel(request.authUser.id, labelId, parseLabel(request.body))
      if (!label) throw new DomainError(404, 'Štítek neexistuje.')
      return label
    })

    app.delete('/api/labels/:labelId', { preHandler: requireAuth }, async (request, reply) => {
      const deleted = await repository.deleteLabel(request.authUser.id, parseUuid((request.params as Record<string, unknown>).labelId, 'ID štítku'))
      if (!deleted) throw new DomainError(404, 'Štítek neexistuje.')
      return reply.code(204).send()
    })
  }
}

function parseCreateWallet(body: unknown): CreateWalletInput {
  const value = asRecord(body)
  assertOnlyKeys(value, ['name', 'colorKey', 'openingBalanceCzk', 'openingBalanceDate', 'walletType', 'countsTowardIndependence', 'availableNow'])
  const countsTowardIndependence = value.countsTowardIndependence === undefined ? undefined : parseOptionalBoolean(value.countsTowardIndependence, 'countsTowardIndependence')
  const availableNow = value.availableNow === undefined ? undefined : parseOptionalBoolean(value.availableNow, 'availableNow')
  if (availableNow && !countsTowardIndependence) throw new DomainError(400, 'Peněženka dostupná hned musí být zároveň počítaná do nezávislosti.')
  return {
    name: normalizeWalletName(value.name),
    colorKey: parseColorKey(value.colorKey),
    openingBalanceCzk: parseWholeCzk(value.openingBalanceCzk, 'Počáteční zůstatek', { allowNegative: true }),
    openingBalanceDate: parseCalendarDate(value.openingBalanceDate, 'Datum počátečního zůstatku'),
    walletType: value.walletType === undefined ? undefined : parseWalletType(value.walletType),
    countsTowardIndependence,
    availableNow,
  }
}

function parseUpdateWallet(body: unknown): UpdateWalletInput {
  const value = asRecord(body)
  assertOnlyKeys(value, ['name', 'colorKey', 'openingBalanceCzk', 'openingBalanceDate', 'isHidden', 'walletType', 'countsTowardIndependence', 'availableNow'])
  const update: UpdateWalletInput = {}

  if ('name' in value) update.name = normalizeWalletName(value.name)
  if ('colorKey' in value) update.colorKey = parseColorKey(value.colorKey)
  if ('walletType' in value) update.walletType = parseWalletType(value.walletType)
  if ('countsTowardIndependence' in value) update.countsTowardIndependence = parseOptionalBoolean(value.countsTowardIndependence, 'countsTowardIndependence')
  if ('availableNow' in value) update.availableNow = parseOptionalBoolean(value.availableNow, 'availableNow')
  if (update.availableNow && update.countsTowardIndependence === false) throw new DomainError(400, 'Peněženka dostupná hned musí být zároveň počítaná do nezávislosti.')
  if ('openingBalanceCzk' in value) update.openingBalanceCzk = parseWholeCzk(value.openingBalanceCzk, 'Počáteční zůstatek', { allowNegative: true })
  if ('openingBalanceDate' in value) update.openingBalanceDate = parseCalendarDate(value.openingBalanceDate, 'Datum počátečního zůstatku')
  if ('isHidden' in value) update.isHidden = parseOptionalBoolean(value.isHidden, 'isHidden')

  return update
}

function parseActualBalance(body: unknown) {
  const value = asRecord(body)
  assertOnlyKeys(value, ['actualBalanceCzk'])
  return parseWholeCzk(value.actualBalanceCzk, 'Skutečný zůstatek', { allowNegative: true })
}

function parseCreateCategory(body: unknown): CreateCategoryInput {
  const value = asRecord(body)
  assertOnlyKeys(value, ['name', 'direction', 'iconKey', 'colorKey'])
  return {
    name: normalizeCategoryName(value.name),
    direction: parseCategoryDirection(value.direction),
    iconKey: parseCategoryIconKey(value.iconKey),
    colorKey: parseColorKey(value.colorKey),
  }
}

function parseUpdateCategory(body: unknown): UpdateCategoryInput {
  const value = asRecord(body)
  assertOnlyKeys(value, ['name', 'iconKey', 'colorKey'])
  const update: UpdateCategoryInput = {}

  if ('name' in value) update.name = normalizeCategoryName(value.name)
  if ('iconKey' in value) update.iconKey = parseCategoryIconKey(value.iconKey)
  if ('colorKey' in value) update.colorKey = parseColorKey(value.colorKey)

  return update
}

export function parseOrder(body: unknown, field: string) {
  const value = asRecord(body)
  assertOnlyKeys(value, [field])
  if (!Array.isArray(value[field]) || value[field].length !== new Set(value[field]).size) {
    throw new DomainError(400, `Pole ${field} musí být seznam jedinečných ID.`)
  }

  return value[field].map((id) => parseUuid(id, field))
}

function parseLabel(body: unknown) {
  const value = asRecord(body)
  assertOnlyKeys(value, ['name'])
  return normalizeLabelName(value.name)
}

function parseLabelListQuery(value: unknown): {
  query: string | null
  cursor: string | null
  limit: number
  sort: LabelListSort
} {
  const query = asRecord(value)
  assertOnlyKeys(query, ['q', 'cursor', 'limit', 'sort'])
  const search = query.q === undefined ? null : normalizeSearch(query.q)
  const cursor = query.cursor === undefined ? null : readQueryString(query.cursor, 'cursor')
  const limit = query.limit === undefined ? 50 : parseLimit(query.limit)
  const sort = query.sort === undefined ? 'alphabetical' : parseLabelSort(query.sort)
  if (sort === 'recent' && cursor) throw new DomainError(400, 'Kurzór nelze použít pro poslední štítky.')
  return { query: search, cursor, limit, sort }
}

function parseLabelSort(value: unknown) {
  if (value === 'alphabetical' || value === 'recent') return value
  throw new DomainError(400, 'Řazení štítků není podporované.')
}

function normalizeSearch(value: unknown) {
  return readQueryString(value, 'q').trim().toLocaleLowerCase('cs-CZ') || null
}

function readQueryString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length > 200) {
    throw new DomainError(400, `Parametr ${field} není platný.`)
  }
  return value
}

function parseLimit(value: unknown) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new DomainError(400, 'Parametr limit není platný.')
  }
  const limit = Number(value)
  if (limit < 1 || limit > 100) throw new DomainError(400, 'Parametr limit musí být mezi 1 a 100.')
  return limit
}
