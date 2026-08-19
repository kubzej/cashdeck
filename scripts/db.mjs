import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const composeFile = path.join(projectRoot, 'database/docker-compose.yml')
const migrationsDir = path.join(projectRoot, 'database/migrations')
const fixtureFile = path.join(projectRoot, 'database/test/fixtures.sql')
const databaseUrl = process.env.CASHDECK_DATABASE_URL
  ?? process.env.CASHDECK_TEST_DATABASE_URL
  ?? 'postgresql://postgres:cashdeck_test@127.0.0.1:55432/cashdeck_test'

function compose(...args) {
  execFileSync('docker', ['compose', '-f', composeFile, ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
  })
}

async function readMigrations() {
  const entries = await fs.readdir(migrationsDir)
  return entries
    .filter((entry) => entry.endsWith('.sql'))
    .sort()
    .map((filename) => ({
      filename,
      version: filename.slice(0, filename.indexOf('_')),
      sqlPath: path.join(migrationsDir, filename),
    }))
}

async function withClient(callback) {
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    return await callback(client)
  } finally {
    await client.end()
  }
}

async function migrate() {
  const migrations = await readMigrations()

  await withClient(async (client) => {
    await client.query(`
      create table if not exists public.schema_migrations (
        version text primary key,
        filename text not null,
        applied_at timestamptz not null default now()
      )
    `)

    const applied = new Set(
      (await client.query('select version from public.schema_migrations order by version')).rows
        .map((row) => row.version),
    )

    for (const migration of migrations) {
      if (applied.has(migration.version)) continue

      const sql = await fs.readFile(migration.sqlPath, 'utf8')
      process.stdout.write(`Applying ${migration.filename}\n`)
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query(
          'insert into public.schema_migrations (version, filename) values ($1, $2)',
          [migration.version, migration.filename],
        )
        await client.query('commit')
      } catch (error) {
        await client.query('rollback')
        throw error
      }
    }
  })
}

async function loadFixture() {
  const sql = await fs.readFile(fixtureFile, 'utf8')
  await withClient((client) => client.query(sql))
}

async function waitForDatabase() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await withClient((client) => client.query('select 1'))
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  throw new Error('Test database did not become ready in 30 seconds.')
}

async function runDatabaseTests() {
  compose('down', '--volumes', '--remove-orphans')
  compose('up', '--build', '--detach')

  try {
    await waitForDatabase()
    await migrate()
    await loadFixture()
    compose(
      'exec',
      '--interactive',
      '-T',
      'postgres',
      'pg_prove',
      '-U',
      'postgres',
      '-d',
      'cashdeck_test',
      '/opt/cashdeck/test/001_database.sql',
    )
  } finally {
    compose('down', '--volumes', '--remove-orphans')
  }
}

const command = process.argv[2] ?? 'migrate'

if (command === 'up') {
  compose('up', '--build', '--detach')
} else if (command === 'down') {
  compose('down', '--volumes', '--remove-orphans')
} else if (command === 'migrate') {
  await migrate()
} else if (command === 'fixture') {
  await loadFixture()
} else if (command === 'test') {
  await runDatabaseTests()
} else {
  throw new Error(`Unknown database command: ${command}`)
}
