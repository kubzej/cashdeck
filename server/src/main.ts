import Fastify from 'fastify'
import { loadConfig } from './config.js'
import { createDatabasePool, verifyDatabaseConnection } from './database.js'

const config = loadConfig()
const database = createDatabasePool(config.databaseUrl)
const app = Fastify({ logger: true })

await verifyDatabaseConnection(database)

app.get('/health', async () => ({ status: 'ok' }))

app.addHook('onClose', async () => {
  await database.end()
})

await app.listen({ host: config.host, port: config.port })
