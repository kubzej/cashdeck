import type { FastifyPluginAsync } from 'fastify'
import type { ServerConfig } from '../config.js'
import { createAuthGuard } from '../auth.js'

export function createSessionRoutes(config: ServerConfig): FastifyPluginAsync {
  const requireAuth = createAuthGuard(config.neonAuthUrl)

  return async function sessionRoutes(app) {
    app.get('/api/session', { preHandler: requireAuth }, async (request) => ({
      userId: request.authUser.id,
    }))
  }
}
