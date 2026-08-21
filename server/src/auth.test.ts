import type { FastifyReply, FastifyRequest } from 'fastify'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { calculateJwkThumbprint, exportJWK, generateKeyPair, SignJWT, type JWK, type CryptoKey } from 'jose'
import { createAuthGuard, getBearerToken, getNeonAuthIssuer } from './auth.js'

const neonAuthUrl = 'https://auth.test/neondb/auth'
const issuer = getNeonAuthIssuer(neonAuthUrl)

let publicJwk: JWK
let privateKey: CryptoKey
let otherPrivateKey: CryptoKey

beforeAll(async () => {
  const pair = await generateKeyPair('ES256', { extractable: true })
  privateKey = pair.privateKey
  publicJwk = await exportJWK(pair.publicKey)
  publicJwk.kid = await calculateJwkThumbprint(publicJwk)
  publicJwk.alg = 'ES256'
  publicJwk.use = 'sig'

  const otherPair = await generateKeyPair('ES256', { extractable: true })
  otherPrivateKey = otherPair.privateKey
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockJwksEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
    const url = input instanceof URL ? input.href : String(input)
    if (!url.endsWith('/.well-known/jwks.json')) throw new Error(`Unexpected fetch to ${url}`)
    return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
}

async function signToken(overrides: {
  alg?: string
  issuer?: string | undefined
  sub?: string | null
  expiresInSeconds?: number
  key?: CryptoKey
  kid?: string
} = {}) {
  const now = Math.floor(Date.now() / 1000)
  const builder = new SignJWT(overrides.sub === undefined || overrides.sub === null ? {} : {})
    .setProtectedHeader({ alg: overrides.alg ?? 'ES256', kid: overrides.kid ?? (publicJwk.kid as string) })
    .setIssuedAt(now)
    .setExpirationTime(now + (overrides.expiresInSeconds ?? 3600))
  if (overrides.issuer !== undefined) builder.setIssuer(overrides.issuer)
  if (overrides.sub !== undefined && overrides.sub !== null) builder.setSubject(overrides.sub)
  return builder.sign(overrides.key ?? privateKey)
}

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

test('accepts a validly signed token from the configured issuer and sets authUser from its subject', async () => {
  mockJwksEndpoint()
  const requireAuth = createAuthGuard(neonAuthUrl)
  const token = await signToken({ issuer, sub: 'user-123' })
  const { request, reply, sendCalls } = createContext()
  request.headers.authorization = `Bearer ${token}`

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([])
  expect(request.authUser).toEqual({ id: 'user-123' })
})

test('rejects a request with no Authorization header', async () => {
  mockJwksEndpoint()
  const requireAuth = createAuthGuard(neonAuthUrl)
  const { request, reply, sendCalls } = createContext()

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([{ statusCode: 401, body: { error: 'Unauthorized' } }])
})

test('rejects a token signed by an untrusted key (bad signature)', async () => {
  mockJwksEndpoint()
  const requireAuth = createAuthGuard(neonAuthUrl)
  const token = await signToken({ issuer, sub: 'user-123', key: otherPrivateKey })
  const { request, reply, sendCalls } = createContext()
  request.headers.authorization = `Bearer ${token}`

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([{ statusCode: 401, body: { error: 'Unauthorized' } }])
  expect(request.authUser).toBeUndefined()
})

test('rejects a token from an untrusted issuer', async () => {
  mockJwksEndpoint()
  const requireAuth = createAuthGuard(neonAuthUrl)
  const token = await signToken({ issuer: 'https://attacker.example', sub: 'user-123' })
  const { request, reply, sendCalls } = createContext()
  request.headers.authorization = `Bearer ${token}`

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([{ statusCode: 401, body: { error: 'Unauthorized' } }])
})

test('rejects an expired token', async () => {
  mockJwksEndpoint()
  const requireAuth = createAuthGuard(neonAuthUrl)
  const token = await signToken({ issuer, sub: 'user-123', expiresInSeconds: -60 })
  const { request, reply, sendCalls } = createContext()
  request.headers.authorization = `Bearer ${token}`

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([{ statusCode: 401, body: { error: 'Unauthorized' } }])
})

test('rejects a token using an unsupported algorithm', async () => {
  mockJwksEndpoint()
  const requireAuth = createAuthGuard(neonAuthUrl)
  // "none" algorithm attack: unsigned token asserting an arbitrary subject.
  const token = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ iss: issuer, sub: 'user-123', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.`
  const { request, reply, sendCalls } = createContext()
  request.headers.authorization = `Bearer ${token}`

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([{ statusCode: 401, body: { error: 'Unauthorized' } }])
})

test('rejects a token with no subject claim', async () => {
  mockJwksEndpoint()
  const requireAuth = createAuthGuard(neonAuthUrl)
  const now = Math.floor(Date.now() / 1000)
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: publicJwk.kid as string })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setIssuer(issuer)
    .sign(privateKey)
  const { request, reply, sendCalls } = createContext()
  request.headers.authorization = `Bearer ${token}`

  await requireAuth(request, reply)

  expect(sendCalls).toEqual([{ statusCode: 401, body: { error: 'Unauthorized' } }])
})

test('never logs the raw token on a rejected request', async () => {
  mockJwksEndpoint()
  const requireAuth = createAuthGuard(neonAuthUrl)
  const token = await signToken({ issuer: 'https://attacker.example', sub: 'user-123' })
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

test('getBearerToken parses only well-formed Bearer headers', () => {
  expect(getBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
  expect(getBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi')
  expect(getBearerToken(undefined)).toBeNull()
  expect(getBearerToken('')).toBeNull()
  expect(getBearerToken('Basic abc')).toBeNull()
  expect(getBearerToken('Bearer')).toBeNull()
})

test('getNeonAuthIssuer derives the origin from the configured Neon Auth URL', () => {
  expect(getNeonAuthIssuer('https://auth.test/neondb/auth')).toBe('https://auth.test')
  expect(getNeonAuthIssuer('https://auth.test/neondb/auth/')).toBe('https://auth.test')
})
