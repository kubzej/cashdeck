import type { FastifyPluginAsync } from 'fastify'
import { issueLocalSessionToken } from '../auth.js'
import { safeEqual } from '../security.js'

/**
 * Passphrase-based unlock, replacing Neon Auth's email/password sign-in — see the comment on
 * `createLocalAuthGuard` in `auth.ts` for why. Single-user app: one shared passphrase gates
 * access, no registration/identity flow.
 */
export function createUnlockRoutes(appAccessPassphrase: string, appUserId: string, sessionSigningSecret: string): FastifyPluginAsync {
  return async function unlockRoutes(app) {
    app.post('/api/unlock', async (request, reply) => {
      const body = request.body as { passphrase?: unknown } | null
      const passphrase = typeof body?.passphrase === 'string' ? body.passphrase : ''

      if (!passphrase || !safeEqual(appAccessPassphrase, passphrase)) {
        request.log.warn('Cashdeck unlock attempt rejected')
        return reply.code(401).send({ error: 'Nesprávné heslo.' })
      }

      const token = await issueLocalSessionToken(sessionSigningSecret, appUserId)
      return { token }
    })
  }
}
