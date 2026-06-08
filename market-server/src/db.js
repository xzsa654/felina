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
    author: row.author ?? null,
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
        SELECT name, version, description, content_hash, updated_at, author
        FROM skills
        WHERE deleted_at IS NULL
        ORDER BY updated_at DESC, name ASC
      `)
      return result.rows.map(mapListRow)
    },

    async getSkill(name) {
      const result = await pool.query(`
        SELECT name, version, description, content_hash, tarball_hash, storage_key, previous_storage_key, updated_at, deleted_at, author
        FROM skills
        WHERE name = $1
      `, [name])
      return result.rows[0] ?? null
    },

    async upsertSkill({ name, version, description, contentHash, tarballHash, storageKey, author, updatedBy, updatedIp }) {
      const result = await pool.query(`
        INSERT INTO skills (name, version, description, content_hash, tarball_hash, storage_key, author, updated_by, updated_ip)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (name) DO UPDATE
        SET version = EXCLUDED.version,
            description = EXCLUDED.description,
            content_hash = EXCLUDED.content_hash,
            tarball_hash = EXCLUDED.tarball_hash,
            previous_storage_key = skills.storage_key,
            storage_key = EXCLUDED.storage_key,
            author = COALESCE(skills.author, EXCLUDED.author),
            updated_by = EXCLUDED.updated_by,
            updated_ip = EXCLUDED.updated_ip,
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
        normalizeNullableString(author),
        normalizeNullableString(updatedBy),
        normalizeNullableString(updatedIp),
      ])
      return mapUpsertRow(result.rows[0])
    },

    async createUser({ email, passwordHash }) {
      const result = await pool.query(`
        INSERT INTO users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email
      `, [email, passwordHash])
      return result.rows[0]
    },

    async getUserByEmail(email) {
      const result = await pool.query(`
        SELECT id, email, password_hash
        FROM users
        WHERE email = $1
      `, [email])
      return result.rows[0] ?? null
    },

    async createRefreshToken({ userId, tokenHash, expiresAt }) {
      const result = await pool.query(`
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, token_hash, expires_at, created_at
      `, [userId, tokenHash, expiresAt])
      return result.rows[0]
    },

    async findRefreshToken(tokenHash) {
      const result = await pool.query(`
        SELECT rt.id, rt.user_id, rt.token_hash, rt.expires_at, rt.created_at, u.email
        FROM refresh_tokens rt
        JOIN users u ON u.id = rt.user_id
        WHERE rt.token_hash = $1
      `, [tokenHash])
      return result.rows[0] ?? null
    },

    async deleteRefreshToken(tokenHash) {
      await pool.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash])
    },

    async deleteAllRefreshTokens(userId) {
      await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId])
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
export const createUser = db.createUser
export const getUserByEmail = db.getUserByEmail
export const createRefreshToken = db.createRefreshToken
export const findRefreshToken = db.findRefreshToken
export const deleteRefreshToken = db.deleteRefreshToken
export const deleteAllRefreshTokens = db.deleteAllRefreshTokens
