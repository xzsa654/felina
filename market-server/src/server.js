import { runner as migrate } from 'node-pg-migrate'

import { createApp } from './app.js'
import { ensureBucket } from './storage.js'

const fastify = createApp()

async function runMigrations() {
  await migrate({
    databaseUrl: process.env.DATABASE_URL,
    dir: 'migrations',
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: (message) => fastify.log.info(message),
  })
}

try {
  await runMigrations()
  await ensureBucket()
  await fastify.listen({ port: 3100, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
