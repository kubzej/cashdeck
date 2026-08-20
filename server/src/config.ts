import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export type ServerConfig = {
  databaseUrl: string
  host: string
  port: number
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

  const port = Number(process.env.PORT ?? 8000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.')
  }

  return {
    databaseUrl,
    host: process.env.HOST ?? '127.0.0.1',
    port,
  }
}
