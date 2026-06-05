import pg from 'pg'

const { Pool } = pg

function normalizeNullableString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapListRow(row) {
  return {
    name: row.name,
    version: row.version,
    description: row.description,
    contentHash: row.content_hash,
    updatedAt: toIso(row.updated_at),
  }
}

function mapUpsertRow(row) {
  return {
    name: row.name,
    contentHash: row.content_hash,
    tarballHash: row.tarball_hash,
    storageKey: row.storage_key,
    updatedAt: toIso(row.updated_at),
  }
}

export function createDb({ pool = new Pool({ connectionString: process.env.DATABASE_URL }) } = {}) {
  return {
    async listSkills() {
      const result = await pool.query(`
        SELECT name, version, description, content_hash, updated_at
        FROM skills
        WHERE deleted_at IS NULL
        ORDER BY updated_at DESC, name ASC
      `)
      return result.rows.map(mapListRow)
    },

    async getSkill(name) {
      const result = await pool.query(`
        SELECT name, version, description, content_hash, tarball_hash, storage_key, previous_storage_key, updated_at, deleted_at
        FROM skills
        WHERE name = $1
      `, [name])
      return result.rows[0] ?? null
    },

    async upsertSkill({ name, version, description, contentHash, tarballHash, storageKey }) {
      const result = await pool.query(`
        INSERT INTO skills (name, version, description, content_hash, tarball_hash, storage_key)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (name) DO UPDATE
        SET version = EXCLUDED.version,
            description = EXCLUDED.description,
            content_hash = EXCLUDED.content_hash,
            tarball_hash = EXCLUDED.tarball_hash,
            previous_storage_key = skills.storage_key,
            storage_key = EXCLUDED.storage_key,
            updated_at = now(),
            deleted_at = NULL
        RETURNING name, content_hash, tarball_hash, storage_key, updated_at
      `, [
        name,
        normalizeNullableString(version),
        normalizeNullableString(description),
        contentHash,
        tarballHash,
        storageKey,
      ])
      return mapUpsertRow(result.rows[0])
    },

    async softDeleteSkill(name) {
      const update = await pool.query(`
        UPDATE skills
        SET deleted_at = now()
        WHERE name = $1 AND deleted_at IS NULL
      `, [name])
      if (update.rowCount > 0) {
        return 'updated'
      }

      const existing = await pool.query('SELECT deleted_at FROM skills WHERE name = $1', [name])
      return existing.rows.length > 0 ? 'already_deleted' : 'not_found'
    },
  }
}

const db = createDb()

export const listSkills = db.listSkills
export const getSkill = db.getSkill
export const upsertSkill = db.upsertSkill
export const softDeleteSkill = db.softDeleteSkill
