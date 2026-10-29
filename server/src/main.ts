import { loadConfig } from './config.js'
import { createDatabasePool, verifyDatabaseConnection } from './database.js'
import { createApp } from './app.js'

const SHUTDOWN_TIMEOUT_MS = 10_000

const config = loadConfig()
let logIdleClientError = (error: Error) => console.error('Cashdeck database idle client error', error)
const database = createDatabasePool(config.databaseUrl, (error) => logIdleClientError(error))

await verifyDatabaseConnection(database)
const app = await createApp({ config, database })
logIdleClientError = (error) => app.log.error({ err: error }, 'Cashdeck database idle client error')

// Railway stops the old container with SIGTERM on every redeploy: finish in-flight requests
// (including a running recurring job) and close the pool instead of cutting them off.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'Cashdeck API shutting down')
    setTimeout(() => {
      app.log.error('Cashdeck API shutdown timed out')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS).unref()
    app.close().then(() => process.exit(0), (error: unknown) => {
      app.log.error({ err: error }, 'Cashdeck API shutdown failed')
      process.exit(1)
    })
  })
}

await app.listen({ host: config.host, port: config.port })
