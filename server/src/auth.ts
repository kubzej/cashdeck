import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose'
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

export function getNeonAuthIssuer(neonAuthUrl: string) {
  return new URL(neonAuthUrl).origin
}

const LOCAL_TOKEN_ISSUER = 'cashdeck-local-auth'

/**
 * Issues and verifies our own HS256 session tokens instead of relying on Neon Auth's
 * cookie-based session. Neon Auth's session cookie doesn't survive in an installed iOS PWA
 * (standalone display mode) — https://github.com/neondatabase/neon/issues/12934. `appUserId`
 * is the single, fixed Cashdeck user — this app has exactly one real user, so there's no
 * sign-up/identity flow, just a shared passphrase gating access to that one account. See
 * `createAuthGuard` below (kept, unused) and `src/lib/auth-client.ts` for the Neon Auth path
 * this replaces, in case Neon fixes the underlying issue and it's worth switching back.
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

export async function issueLocalSessionToken(sessionSigningSecret: string, userId: string) {
  const secretKey = new TextEncoder().encode(sessionSigningSecret)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(LOCAL_TOKEN_ISSUER)
    .setIssuedAt()
    .setExpirationTime('400d')
    .sign(secretKey)
}

/** Neon Auth's cookie-based sign-in, kept but unused — see `createLocalAuthGuard` above. */
export function createAuthGuard(neonAuthUrl: string) {
  const authUrl = neonAuthUrl.replace(/\/+$/, '')
  const issuer = getNeonAuthIssuer(authUrl)
  const jwks = createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`))

  return async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const token = getBearerToken(request.headers.authorization)
    if (!token) {
      request.log.warn('Cashdeck API request did not include a Bearer token')
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const { payload } = await jwtVerify(token, jwks, {
        algorithms: ['EdDSA', 'ES256', 'RS256'],
        issuer,
      })

      if (!payload.sub) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      request.authUser = { id: payload.sub }
    } catch (error) {
      const claim = typeof error === 'object' && error !== null && 'claim' in error ? error.claim : undefined

      request.log.warn(
        {
          authError: error instanceof Error ? error.name : 'UnknownAuthError',
          code: typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined,
          claim,
          reason: typeof error === 'object' && error !== null && 'reason' in error ? error.reason : undefined,
        },
        'Cashdeck API rejected a Neon Auth JWT',
      )
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  }
}
