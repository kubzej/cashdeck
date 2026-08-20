import type { FastifyPluginAsync } from 'fastify'
import type { AuthGuard } from '../auth.js'

export function createSessionRoutes(requireAuth: AuthGuard): FastifyPluginAsync {
  return async function sessionRoutes(app) {
    app.get('/api/session', { preHandler: requireAuth }, async (request) => ({
      userId: request.authUser.id,
    }))
  }
}
