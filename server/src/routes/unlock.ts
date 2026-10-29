import type { FastifyPluginAsync } from 'fastify'
import { createAttemptLimiter, type AttemptLimiter } from '../attempt-limiter.js'
import { issueLocalSessionToken } from '../auth.js'
import { safeEqual } from '../security.js'

const MINUTE_MS = 60_000

/**
 * Passphrase-based unlock, replacing Neon Auth's email/password sign-in — see the comment on
 * `createLocalAuthGuard` in `auth.ts` for why. Single-user app: one shared passphrase gates
 * access, no registration/identity flow. Failed attempts are rate limited because the
 * passphrase is the only factor protecting the whole account.
 */
export function createUnlockRoutes(
  appAccessPassphrase: string,
  appUserId: string,
  sessionSigningSecret: string,
  limiter: AttemptLimiter = createAttemptLimiter({
    perClient: { maxFailures: 5, windowMs: 15 * MINUTE_MS },
    global: { maxFailures: 30, windowMs: 60 * MINUTE_MS },
  }),
): FastifyPluginAsync {
  return async function unlockRoutes(app) {
    app.post('/api/unlock', async (request, reply) => {
      const retryAfter = limiter.retryAfterSeconds(request.ip)
      if (retryAfter !== null) {
        request.log.warn({ retryAfter }, 'Cashdeck unlock attempt blocked by rate limit')
        return reply.code(429).header('retry-after', String(retryAfter)).send({ error: 'Příliš mnoho pokusů. Zkus to později.' })
      }

      const body = request.body as { passphrase?: unknown } | null
      const passphrase = typeof body?.passphrase === 'string' ? body.passphrase : ''

      if (!passphrase || !safeEqual(appAccessPassphrase, passphrase)) {
        limiter.recordFailure(request.ip)
        request.log.warn('Cashdeck unlock attempt rejected')
        return reply.code(401).send({ error: 'Nesprávné heslo.' })
      }

      limiter.recordSuccess(request.ip)
      const token = await issueLocalSessionToken(sessionSigningSecret, appUserId)
      return { token }
    })
  }
}
