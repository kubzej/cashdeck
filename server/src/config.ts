import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export type ServerConfig = {
  databaseUrl: string
  frontendOrigin: string
  host: string
  // Kept for a possible future revert — see the note on `sessionSigningSecret` below.
  // No longer read by the active auth guard, so it's optional at boot.
  neonAuthUrl?: string
  port: number
  recurringJobSecret?: string
  // Local passphrase-unlock auth, replacing Neon Auth's email/password sign-in as of
  // 2026-08-21: Neon Auth's session cookie doesn't survive in an installed iOS PWA
  // (standalone display mode) — https://github.com/neondatabase/neon/issues/12934.
  // `src/lib/auth-client.ts` and the `@neondatabase/auth` dependency are kept in the repo
  // in case that gets fixed and it's worth switching back.
  sessionSigningSecret: string
  appAccessPassphrase: string
  appUserId: string
}

export function loadConfig(): ServerConfig {
  try {
    process.loadEnvFile(path.join(serverRoot, '.env.local'))
  } catch (error: unknown) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error
    }
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required in server/.env.local.')
  }

  const neonAuthUrl = process.env.NEON_AUTH_URL?.replace(/\/+$/, '') || undefined

  const frontendOrigin = process.env.FRONTEND_ORIGIN
  if (!frontendOrigin) {
    throw new Error('FRONTEND_ORIGIN is required in server/.env.local.')
  }

  const port = Number(process.env.PORT ?? 8000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.')
  }

  const sessionSigningSecret = process.env.SESSION_SIGNING_SECRET
  if (!sessionSigningSecret || sessionSigningSecret.length < 32) {
    throw new Error('SESSION_SIGNING_SECRET is required in server/.env.local and must contain at least 32 characters.')
  }

  const appAccessPassphrase = process.env.APP_ACCESS_PASSPHRASE
  if (!appAccessPassphrase) {
    throw new Error('APP_ACCESS_PASSPHRASE is required in server/.env.local.')
  }

  const appUserId = process.env.APP_USER_ID
  if (!appUserId) {
    throw new Error('APP_USER_ID is required in server/.env.local.')
  }

  return {
    databaseUrl,
    frontendOrigin,
    host: process.env.HOST ?? '127.0.0.1',
    neonAuthUrl,
    port,
    recurringJobSecret: parseRecurringJobSecret(process.env.RECURRING_JOB_SECRET),
    sessionSigningSecret,
    appAccessPassphrase,
    appUserId,
  }
}

function parseRecurringJobSecret(value: string | undefined) {
  if (value === undefined || value === '') return undefined
  if (value.length < 32) throw new Error('RECURRING_JOB_SECRET must contain at least 32 characters.')
  return value
}
