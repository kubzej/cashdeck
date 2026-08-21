import cors from '@fastify/cors'
import Fastify from 'fastify'
import type { Pool } from 'pg'
import { createAuthGuard, type AuthGuard } from './auth.js'
import type { ServerConfig } from './config.js'
import { createFeedRepository, type FeedRepository } from './feed/repository.js'
import { DomainError } from './management/domain.js'
import { createManagementRepository, type ManagementRepository } from './management/repository.js'
import { createManagementRoutes } from './routes/management.js'
import { createRecurringJobRoutes } from './routes/recurring-job.js'
import { createRecurringRuleRoutes } from './routes/recurring.js'
import { createFeedRoutes } from './routes/feed.js'
import { createSessionRoutes } from './routes/session.js'
import { createTransactionRoutes } from './routes/transactions.js'
import { createTransferRoutes } from './routes/transfers.js'
import { createTransactionRepository, type TransactionRepository } from './transactions/repository.js'
import { createTransferRepository, type TransferRepository } from './transfers/repository.js'
import { createRecurringRuleRepository, type RecurringRuleRepository } from './recurring/repository.js'
import { createPlannedRepository, type PlannedRepository } from './planned/repository.js'
import { createPlannedRoutes } from './routes/planned.js'

type AppDependencies = {
  config: ServerConfig
  database: Pool
  managementRepository?: ManagementRepository
  feedRepository?: FeedRepository
  transactionRepository?: TransactionRepository
  transferRepository?: TransferRepository
  recurringRuleRepository?: RecurringRuleRepository
  plannedRepository?: PlannedRepository
  requireAuth?: AuthGuard
}

export async function createApp({ config, database, managementRepository, feedRepository, transactionRepository, transferRepository, recurringRuleRepository, plannedRepository, requireAuth }: AppDependencies) {
  const app = Fastify({ logger: true })
  const authGuard = requireAuth ?? createAuthGuard(config.neonAuthUrl)
  const repository = managementRepository ?? createManagementRepository(database)
  const feed = feedRepository ?? createFeedRepository(database)
  const transactions = transactionRepository ?? createTransactionRepository(database)
  const transfers = transferRepository ?? createTransferRepository(database)
  const recurringRules = recurringRuleRepository ?? createRecurringRuleRepository(database)
  const planned = plannedRepository ?? createPlannedRepository(database)

  await app.register(cors, {
    origin: config.frontendOrigin,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type'],
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply.code(error.statusCode).send({ error: error.message })
    }

    if (isConflictError(error)) {
      return reply.code(409).send({ error: 'Změna je v konfliktu s existujícími daty.' })
    }

    request.log.error({ err: error }, 'Cashdeck API request failed')
    return reply.code(500).send({ error: 'Interní chyba serveru.' })
  })

  app.get('/health', async () => ({ status: 'ok' }))
  await app.register(createSessionRoutes(authGuard))
  await app.register(createManagementRoutes(repository, authGuard))
  await app.register(createFeedRoutes(feed, authGuard))
  await app.register(createTransactionRoutes(transactions, authGuard))
  await app.register(createTransferRoutes(transfers, authGuard))
  await app.register(createRecurringRuleRoutes(recurringRules, authGuard))
  await app.register(createPlannedRoutes(planned, authGuard))
  if (config.recurringJobSecret) await app.register(createRecurringJobRoutes(recurringRules, config.recurringJobSecret))

  app.addHook('onClose', async () => {
    await database.end()
  })

  return app
}

function isConflictError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && ['23503', '23505', 'P0001'].includes(String(error.code))
}
