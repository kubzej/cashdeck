import type { FastifyPluginAsync } from 'fastify'
import type { AuthGuard } from '../auth.js'
import { parsePlannedListQuery } from '../planned/domain.js'
import type { PlannedRepository } from '../planned/repository.js'

export function createPlannedRoutes(repository: PlannedRepository, requireAuth: AuthGuard): FastifyPluginAsync {
  return async function plannedRoutes(app) {
    app.get('/api/planned', { preHandler: requireAuth }, async (request) => repository.listPlanned(request.authUser.id, parsePlannedListQuery(request.query)))
  }
}
