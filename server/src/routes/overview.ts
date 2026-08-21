import type { FastifyPluginAsync } from 'fastify'
import type { AuthGuard } from '../auth.js'
import { parseOverviewQuery } from '../overview/domain.js'
import type { OverviewRepository } from '../overview/repository.js'

export function createOverviewRoutes(repository: OverviewRepository, requireAuth: AuthGuard): FastifyPluginAsync {
  return async function overviewRoutes(app) {
    app.get('/api/overview', { preHandler: requireAuth }, async (request) => repository.getOverview(request.authUser.id, parseOverviewQuery(request.query)))
  }
}
