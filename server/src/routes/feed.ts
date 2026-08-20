import type { FastifyPluginAsync } from 'fastify'
import type { AuthGuard } from '../auth.js'
import { parseFeedListQuery } from '../feed/domain.js'
import type { FeedRepository } from '../feed/repository.js'

export function createFeedRoutes(repository: FeedRepository, requireAuth: AuthGuard): FastifyPluginAsync {
  return async function feedRoutes(app) {
    app.get('/api/feed', { preHandler: requireAuth }, async (request) => repository.listFeed(request.authUser.id, parseFeedListQuery(request.query)))
  }
}
