import cors from '@fastify/cors'
import Fastify from 'fastify'
import type { Pool } from 'pg'
import { createAuthGuard, type AuthGuard } from './auth.js'
import type { ServerConfig } from './config.js'
import { DomainError } from './management/domain.js'
import { createManagementRepository, type ManagementRepository } from './management/repository.js'
import { createManagementRoutes } from './routes/management.js'
import { createSessionRoutes } from './routes/session.js'

type AppDependencies = {
  config: ServerConfig
  database: Pool
  managementRepository?: ManagementRepository
  requireAuth?: AuthGuard
}

export async function createApp({ config, database, managementRepository, requireAuth }: AppDependencies) {
  const app = Fastify({ logger: true })
  const authGuard = requireAuth ?? createAuthGuard(config.neonAuthUrl)
  const repository = managementRepository ?? createManagementRepository(database)

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
