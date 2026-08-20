import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { FastifyReply, FastifyRequest } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    authUser: { id: string }
  }
}

export function getBearerToken(header: string | undefined) {
  const match = header?.match(/^Bearer\s+([^\s]+)$/i)
  return match?.[1] ?? null
}

export function getNeonAuthIssuer(neonAuthUrl: string) {
  return new URL(neonAuthUrl).origin
}

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
