import type { FastifyReply, FastifyRequest } from 'fastify'
import { expect, test } from 'vitest'
import { SignJWT } from 'jose'
import { createLocalAuthGuard, getBearerToken, issueLocalSessionToken } from './auth.js'

function createContext() {
  const authUser: { id: string } | undefined = undefined
  const request = {
    headers: {} as Record<string, string>,
    authUser,
    log: { warn: () => {} },
  } as unknown as FastifyRequest
  const sendCalls: Array<{ statusCode: number; body: unknown }> = []
  const reply = {
    code(statusCode: number) {
      return { send: (body: unknown) => { sendCalls.push({ statusCode, body }) } }
    },
  } as unknown as FastifyReply
  return { request, reply, sendCalls }
}

test('getBearerToken parses only well-formed Bearer headers', () => {
  expect(getBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
  expect(getBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi')
  expect(getBearerToken(undefined)).toBeNull()
  expect(getBearerToken('')).toBeNull()
  expect(getBearerToken('Basic abc')).toBeNull()
  expect(getBearerToken('Bearer')).toBeNull()
})

const sessionSigningSecret = 'test-session-signing-secret-32-characters-long'

test('issueLocalSessionToken issues a token that createLocalAuthGuard accepts and sets authUser from it', async () => {
  const requireAuth = createLocalAuthGuard(sessionSigningSecret)
  const token = await issueLocalSessionToken(sessionSigningSecret, 'user-123')
  const { request, reply, sendCalls } = createContext()
  request.headers.authorization = `Bearer ${token}`

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([])
  expect(request.authUser).toEqual({ id: 'user-123' })
})

test('createLocalAuthGuard rejects a request with no Authorization header', async () => {
  const requireAuth = createLocalAuthGuard(sessionSigningSecret)
  const { request, reply, sendCalls } = createContext()

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([{ statusCode: 401, body: { error: 'Unauthorized' } }])
})

test('createLocalAuthGuard rejects a token signed with a different secret', async () => {
  const requireAuth = createLocalAuthGuard(sessionSigningSecret)
  const token = await issueLocalSessionToken('a-completely-different-32-char-secret', 'user-123')
  const { request, reply, sendCalls } = createContext()
  request.headers.authorization = `Bearer ${token}`

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([{ statusCode: 401, body: { error: 'Unauthorized' } }])
  expect(request.authUser).toBeUndefined()
})

test('createLocalAuthGuard rejects an expired token', async () => {
  const requireAuth = createLocalAuthGuard(sessionSigningSecret)
  const now = Math.floor(Date.now() / 1000)
  const secretKey = new TextEncoder().encode(sessionSigningSecret)
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-123')
    .setIssuer('cashdeck-local-auth')
    .setIssuedAt(now - 120)
    .setExpirationTime(now - 60)
    .sign(secretKey)
  const { request, reply, sendCalls } = createContext()
  request.headers.authorization = `Bearer ${token}`

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([{ statusCode: 401, body: { error: 'Unauthorized' } }])
})

test('createLocalAuthGuard rejects a token from an untrusted issuer', async () => {
  const requireAuth = createLocalAuthGuard(sessionSigningSecret)
  const now = Math.floor(Date.now() / 1000)
  const secretKey = new TextEncoder().encode(sessionSigningSecret)
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-123')
    .setIssuer('attacker-issued')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(secretKey)
  const { request, reply, sendCalls } = createContext()
  request.headers.authorization = `Bearer ${token}`

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([{ statusCode: 401, body: { error: 'Unauthorized' } }])
})

test('createLocalAuthGuard rejects a token using an unsupported algorithm', async () => {
  const requireAuth = createLocalAuthGuard(sessionSigningSecret)
  // "none" algorithm attack: unsigned token asserting an arbitrary subject.
  const token = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ iss: 'cashdeck-local-auth', sub: 'user-123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.`
  const { request, reply, sendCalls } = createContext()
  request.headers.authorization = `Bearer ${token}`

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([{ statusCode: 401, body: { error: 'Unauthorized' } }])
})

test('createLocalAuthGuard never logs the raw token on a rejected request', async () => {
  const requireAuth = createLocalAuthGuard(sessionSigningSecret)
  const token = await issueLocalSessionToken('a-completely-different-32-char-secret', 'user-123')
  const warnCalls: unknown[] = []
  const { reply, sendCalls } = createContext()
  const request = {
    headers: { authorization: `Bearer ${token}` },
    log: { warn: (...args: unknown[]) => warnCalls.push(args) },
  } as unknown as FastifyRequest

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([{ statusCode: 401, body: { error: 'Unauthorized' } }])
  expect(JSON.stringify(warnCalls)).not.toContain(token)
})
