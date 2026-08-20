import { expect, test } from 'vitest'
import { getBearerToken, getNeonAuthIssuer } from './auth.js'

test('reads only a complete Bearer authorization value', () => {
  expect(getBearerToken('Bearer token-1')).toBe('token-1')
  expect(getBearerToken('bearer token-2')).toBe('token-2')
  expect(getBearerToken('Basic token-3')).toBeNull()
  expect(getBearerToken('Bearer')).toBeNull()
  expect(getBearerToken(undefined)).toBeNull()
})

test('uses the Neon Auth host as the JWT issuer', () => {
  expect(getNeonAuthIssuer('https://example.neonauth.neon.tech/neondb/auth')).toBe(
    'https://example.neonauth.neon.tech',
  )
})
