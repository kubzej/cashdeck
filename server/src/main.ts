import { loadConfig } from './config.js'
import { createDatabasePool, verifyDatabaseConnection } from './database.js'
import { createApp } from './app.js'

const config = loadConfig()
const database = createDatabasePool(config.databaseUrl)

await verifyDatabaseConnection(database)
const app = await createApp({ config, database })

await app.listen({ host: config.host, port: config.port })
