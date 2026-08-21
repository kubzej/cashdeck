import type { FastifyPluginAsync } from 'fastify'
import type { AuthGuard } from '../auth.js'
import { parseOverviewQuery, parseOverviewSelectionQuery } from '../overview/domain.js'
import type { OverviewRepository } from '../overview/repository.js'

export function createOverviewRoutes(repository: OverviewRepository, requireAuth: AuthGuard): FastifyPluginAsync {
  return async function overviewRoutes(app) {
    app.get('/api/overview', { preHandler: requireAuth }, async (request) => repository.getOverview(request.authUser.id, parseOverviewQuery(request.query)))
    app.get('/api/overview/selection', { preHandler: requireAuth }, async (request) => repository.getSelectionTrend(request.authUser.id, parseOverviewSelectionQuery(request.query)))
  }
}
