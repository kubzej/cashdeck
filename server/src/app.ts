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
import { createOverviewRoutes } from './routes/overview.js'
import { createOverviewRepository, type OverviewRepository } from './overview/repository.js'

type AppDependencies = {
  config: ServerConfig
  database: Pool
  managementRepository?: ManagementRepository
  feedRepository?: FeedRepository
  transactionRepository?: TransactionRepository
  transferRepository?: TransferRepository
  recurringRuleRepository?: RecurringRuleRepository
  plannedRepository?: PlannedRepository
  overviewRepository?: OverviewRepository
  requireAuth?: AuthGuard
}

export async function createApp({ config, database, managementRepository, feedRepository, transactionRepository, transferRepository, recurringRuleRepository, plannedRepository, overviewRepository, requireAuth }: AppDependencies) {
  const app = Fastify({ logger: true })
  const authGuard = requireAuth ?? createAuthGuard(config.neonAuthUrl)
  const repository = managementRepository ?? createManagementRepository(database)
  const feed = feedRepository ?? createFeedRepository(database)
  const transactions = transactionRepository ?? createTransactionRepository(database)
  const transfers = transferRepository ?? createTransferRepository(database)
  const recurringRules = recurringRuleRepository ?? createRecurringRuleRepository(database)
  const planned = plannedRepository ?? createPlannedRepository(database)
  const overview = overviewRepository ?? createOverviewRepository(database)

  await app.register(cors, {
    origin: config.frontendOrigin,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type'],
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply.code(error.statusCode).send({ error: error.message })
    }

    const conflictMessage = mapConflictError(error)
    if (conflictMessage) {
      return reply.code(409).send({ error: conflictMessage })
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
  await app.register(createOverviewRoutes(overview, authGuard))
  if (config.recurringJobSecret) await app.register(createRecurringJobRoutes(recurringRules, config.recurringJobSecret))

  app.addHook('onClose', async () => {
    await database.end()
  })

  return app
}

const DUPLICATE_NAME_MESSAGES: Record<string, string> = {
  wallets_user_id_normalized_name_unique: 'Peněženka s tímto názvem už existuje.',
  categories_user_id_direction_normalized_name_unique: 'Kategorie s tímto názvem už v tomto směru existuje.',
  labels_user_id_normalized_name_unique: 'Štítek s tímto názvem už existuje.',
}

const DELETE_BLOCKED_MESSAGES: Record<string, string> = {
  transactions_wallet_same_user_fkey: 'Peněženku nelze smazat, obsahuje transakce.',
  transactions_category_same_user_fkey: 'Kategorii nelze smazat, je použita v transakcích.',
  transfers_source_wallet_same_user_fkey: 'Peněženku nelze smazat, obsahuje převody.',
  transfers_destination_wallet_same_user_fkey: 'Peněženku nelze smazat, obsahuje převody.',
  balance_adjustments_wallet_same_user_fkey: 'Peněženku nelze smazat, obsahuje vyrovnání zůstatku.',
  recurring_rules_transaction_wallet_same_user_fkey: 'Peněženku nelze smazat, je použita v opakujícím se pravidle.',
  recurring_rules_source_wallet_same_user_fkey: 'Peněženku nelze smazat, je použita v opakujícím se pravidle.',
  recurring_rules_destination_wallet_same_user_fkey: 'Peněženku nelze smazat, je použita v opakujícím se pravidle.',
  recurring_rules_category_same_user_fkey: 'Kategorii nelze smazat, je použita v opakujícím se pravidle.',
}

const RAISED_MESSAGE_TRANSLATIONS: Array<{ match: string; message: string }> = [
  { match: 'Wallet opening balance cannot change after linked financial records exist', message: 'Počáteční zůstatek nelze změnit, peněženka už má pohyby.' },
  { match: 'Category direction cannot be changed', message: 'Směr kategorie nelze po vytvoření změnit.' },
  { match: 'Transaction date cannot be before the wallet opening balance date', message: 'Datum transakce nemůže být před datem založení peněženky.' },
  { match: 'Transfer date cannot be before either wallet opening balance date', message: 'Datum převodu nemůže být před datem založení peněženky.' },
  { match: 'Balance adjustment date cannot be before the wallet opening balance date', message: 'Datum vyrovnání zůstatku nemůže být před datem založení peněženky.' },
]

function mapConflictError(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  const code = String((error as { code: unknown }).code)
  const constraint = 'constraint' in error ? String((error as { constraint: unknown }).constraint ?? '') : ''
  const message = 'message' in error ? String((error as { message: unknown }).message ?? '') : ''

  const raised = RAISED_MESSAGE_TRANSLATIONS.find((entry) => message.includes(entry.match))
  if (raised) return raised.message

  if (code === '23505') return DUPLICATE_NAME_MESSAGES[constraint] ?? 'Tento název už existuje.'
  if (code === '23503') return DELETE_BLOCKED_MESSAGES[constraint] ?? 'Tuto položku nelze smazat, je stále používaná.'
  if (code === '23514' || code === 'P0001') return 'Změna je v konfliktu s existujícími daty.'
  return null
}
