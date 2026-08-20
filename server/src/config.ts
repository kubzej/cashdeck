import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export type ServerConfig = {
  databaseUrl: string
  frontendOrigin: string
  host: string
  neonAuthUrl: string
  port: number
  recurringJobSecret?: string
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

  const neonAuthUrl = process.env.NEON_AUTH_URL?.replace(/\/+$/, '')
  if (!neonAuthUrl) {
    throw new Error('NEON_AUTH_URL is required in server/.env.local.')
  }

  const frontendOrigin = process.env.FRONTEND_ORIGIN
  if (!frontendOrigin) {
    throw new Error('FRONTEND_ORIGIN is required in server/.env.local.')
  }

  const port = Number(process.env.PORT ?? 8000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.')
  }

  return {
    databaseUrl,
    frontendOrigin,
    host: process.env.HOST ?? '127.0.0.1',
    neonAuthUrl,
    port,
    recurringJobSecret: parseRecurringJobSecret(process.env.RECURRING_JOB_SECRET),
  }
}

function parseRecurringJobSecret(value: string | undefined) {
  if (value === undefined || value === '') return undefined
  if (value.length < 32) throw new Error('RECURRING_JOB_SECRET must contain at least 32 characters.')
  return value
}
