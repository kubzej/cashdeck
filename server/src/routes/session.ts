import type { FastifyPluginAsync } from 'fastify'
import { issueLocalSessionToken, type AuthGuard } from '../auth.js'

export function createSessionRoutes(requireAuth: AuthGuard, sessionSigningSecret: string): FastifyPluginAsync {
  return async function sessionRoutes(app) {
    // Sliding session: every verified launch swaps the token for a fresh one, keeping the
    // token lifetime short without making the user unlock again while they use the app.
    app.get('/api/session', { preHandler: requireAuth }, async (request) => ({
      userId: request.authUser.id,
      token: await issueLocalSessionToken(sessionSigningSecret, request.authUser.id),
    }))
  }
}
