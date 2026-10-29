import { afterEach, beforeEach, expect, test } from 'vitest'
import { loadConfig } from './config.js'

const validEnv = {
  DATABASE_URL: 'postgres://unused',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  SESSION_SIGNING_SECRET: 'a'.repeat(32),
  APP_ACCESS_PASSPHRASE: 'test-passphrase',
  APP_USER_ID: 'user-1',
}
const managedKeys = [...Object.keys(validEnv), 'PORT', 'HOST', 'RECURRING_JOB_SECRET']
const missingEnvFile = '/nonexistent/cashdeck.env'

let saved: Record<string, string | undefined>
beforeEach(() => {
  saved = Object.fromEntries(managedKeys.map((key) => [key, process.env[key]]))
  for (const key of managedKeys) delete process.env[key]
})
afterEach(() => {
  for (const key of managedKeys) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

function setEnv(overrides: Record<string, string | undefined> = {}) {
  for (const [key, value] of Object.entries({ ...validEnv, ...overrides })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

test('a complete environment loads with local defaults for host and port', () => {
  setEnv()
  expect(loadConfig(missingEnvFile)).toEqual({
    databaseUrl: 'postgres://unused', frontendOrigin: 'http://localhost:5173', host: '127.0.0.1', port: 8000,
    recurringJobSecret: undefined, sessionSigningSecret: 'a'.repeat(32), appAccessPassphrase: 'test-passphrase', appUserId: 'user-1',
  })
})

test.each(['DATABASE_URL', 'FRONTEND_ORIGIN', 'SESSION_SIGNING_SECRET', 'APP_ACCESS_PASSPHRASE', 'APP_USER_ID'])('a missing %s stops the start-up and names the variable', (key) => {
  setEnv({ [key]: undefined })
  expect(() => loadConfig(missingEnvFile)).toThrow(key)
})

test.each(['cashdeck.netlify.app', 'https://cashdeck.netlify.app/', 'https://cashdeck.netlify.app/app', 'not a url'])('FRONTEND_ORIGIN %s is not a bare origin', (origin) => {
  setEnv({ FRONTEND_ORIGIN: origin })
  expect(() => loadConfig(missingEnvFile)).toThrow('FRONTEND_ORIGIN must be an origin')
})

test('FRONTEND_ORIGIN accepts an origin with a port', () => {
  setEnv({ FRONTEND_ORIGIN: 'http://127.0.0.1:5173' })
  expect(loadConfig(missingEnvFile).frontendOrigin).toBe('http://127.0.0.1:5173')
})

test('a session signing secret shorter than 32 characters is refused', () => {
  setEnv({ SESSION_SIGNING_SECRET: 'a'.repeat(31) })
  expect(() => loadConfig(missingEnvFile)).toThrow('at least 32 characters')
})

test.each(['0', '65536', '80.5', 'abc', '-1'])('port %s is not a valid TCP port', (port) => {
  setEnv({ PORT: port })
  expect(() => loadConfig(missingEnvFile)).toThrow('PORT must be a valid TCP port.')
})

test('a port inside the TCP range is accepted', () => {
  setEnv({ PORT: '65535' })
  expect(loadConfig(missingEnvFile).port).toBe(65535)
})

test('the recurring job secret is optional, but when set it must be at least 32 characters', () => {
  setEnv({ RECURRING_JOB_SECRET: '' })
  expect(loadConfig(missingEnvFile).recurringJobSecret).toBeUndefined()
  setEnv({ RECURRING_JOB_SECRET: 'b'.repeat(31) })
  expect(() => loadConfig(missingEnvFile)).toThrow('RECURRING_JOB_SECRET')
  setEnv({ RECURRING_JOB_SECRET: 'b'.repeat(32) })
  expect(loadConfig(missingEnvFile).recurringJobSecret).toBe('b'.repeat(32))
})
