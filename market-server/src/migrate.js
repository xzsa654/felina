import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  // Seed from node-pg-migrate's pgmigrations if transitioning
  const pgmExists = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'pgmigrations'
    ) AS exists
  `)
  if (pgmExists.rows[0].exists) {
    const legacy = await pool.query('SELECT name FROM pgmigrations')
    for (const row of legacy.rows) {
      const fileName = row.name.endsWith('.sql') ? row.name : `${row.name}.sql`
      await pool.query(
        `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
        [fileName]
      )
    }
  }

  const migrationsDir = join(import.meta.dirname, '..', 'migrations')
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort()

  const applied = await pool.query('SELECT name FROM schema_migrations')
  const appliedSet = new Set(applied.rows.map(r => r.name))

  for (const file of files) {
    if (appliedSet.has(file)) continue
    const sql = await readFile(join(migrationsDir, file), 'utf8')
    await pool.query(sql)
    await pool.query(
      'INSERT INTO schema_migrations (name) VALUES ($1)',
      [file]
    )
    console.log(`Applied: ${file}`)
  }

  console.log('Migrations complete')
} catch (err) {
  console.error('Migration failed:', err)
  process.exit(1)
} finally {
  await pool.end()
}
