import { jwtVerify, SignJWT } from 'jose'
import type { FastifyReply, FastifyRequest } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    authUser: { id: string }
  }
}

export type AuthGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>

export function getBearerToken(header: string | undefined) {
  const match = header?.match(/^Bearer\s+([^\s]+)$/i)
  return match?.[1] ?? null
}

const LOCAL_TOKEN_ISSUER = 'cashdeck-local-auth'

/**
 * Issues and verifies our own HS256 session tokens instead of relying on Neon Auth's
 * cookie-based session. Neon Auth's session cookie doesn't survive in an installed iOS PWA
 * (standalone display mode) — https://github.com/neondatabase/neon/issues/12934. `appUserId`
 * is the single, fixed Cashdeck user — this app has exactly one real user, so there's no
 * sign-up/identity flow, just a shared passphrase gating access to that one account.
 */
export function createLocalAuthGuard(sessionSigningSecret: string) {
  const secretKey = new TextEncoder().encode(sessionSigningSecret)

  return async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const token = getBearerToken(request.headers.authorization)
    if (!token) {
      request.log.warn('Cashdeck API request did not include a Bearer token')
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'], issuer: LOCAL_TOKEN_ISSUER })
      if (!payload.sub) return reply.code(401).send({ error: 'Unauthorized' })
      request.authUser = { id: payload.sub }
    } catch (error) {
      request.log.warn({ authError: error instanceof Error ? error.name : 'UnknownAuthError' }, 'Cashdeck API rejected a local session token')
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  }
}

/**
 * Short enough that a leaked token expires within a month; `/api/session` reissues a fresh one
 * on every app launch, so the user only re-enters the passphrase after 30 days of not opening
 * the app. Tokens can't be revoked individually — rotating `SESSION_SIGNING_SECRET` invalidates
 * every issued token at once.
 */
export const LOCAL_SESSION_TOKEN_TTL = '30d'

export async function issueLocalSessionToken(sessionSigningSecret: string, userId: string) {
  const secretKey = new TextEncoder().encode(sessionSigningSecret)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(LOCAL_TOKEN_ISSUER)
    .setIssuedAt()
    .setExpirationTime(LOCAL_SESSION_TOKEN_TTL)
    .sign(secretKey)
}
