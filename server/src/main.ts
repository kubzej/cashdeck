import Fastify from 'fastify'
import cors from '@fastify/cors'
import { loadConfig } from './config.js'
import { createDatabasePool, verifyDatabaseConnection } from './database.js'
import { createSessionRoutes } from './routes/session.js'

const config = loadConfig()
const database = createDatabasePool(config.databaseUrl)
const app = Fastify({ logger: true })

await verifyDatabaseConnection(database)

await app.register(cors, {
  origin: config.frontendOrigin,
  methods: ['GET'],
  allowedHeaders: ['authorization'],
})

app.get('/health', async () => ({ status: 'ok' }))
await app.register(createSessionRoutes(config))

app.addHook('onClose', async () => {
  await database.end()
})

await app.listen({ host: config.host, port: config.port })
