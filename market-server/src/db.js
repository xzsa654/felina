import pg from 'pg'

const { Pool } = pg

function normalizeNullableString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toIsoDate(value) {
  // pg parses DATE columns to a Date at local midnight; format from local
  // components so the calendar date is not shifted by UTC conversion.
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(value).slice(0, 10)
}

const LEADERBOARD_SORT_COLUMNS = {
  tokens: 'total_tokens',
  cost: 'total_cost_usd',
  active_days: 'active_days',
}

function mapLeaderboardRow(row) {
  return {
    rank: Number(row.rank),
    handle: row.handle,
    totalTokens: Number(row.total_tokens),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    cacheReadTokens: Number(row.cache_read_tokens),
    cacheWriteTokens: Number(row.cache_write_tokens),
    reasoningTokens: Number(row.reasoning_tokens),
    totalCostUsd: row.total_cost_usd,
    eventCount: Number(row.event_count),
    activeDays: row.active_days,
    topModel: row.top_model ?? null,
    submitCount: row.submit_count,
    userId: row.user_id,
  }
}

const LEADERBOARD_WINDOW_COLUMNS = {
  tokens: 'total_tokens',
  cost: 'total_cost_usd',
  active_days: 'active_days',
}

function mapWindowedRow(row) {
  return {
    rank: Number(row.rank),
    handle: row.handle,
    totalTokens: Number(row.total_tokens),
    totalCostUsd: row.total_cost_usd,
    activeDays: row.active_days,
    submitCount: row.submit_count,
    topModel: row.top_model ?? null,
    userId: row.user_id,
  }
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
    previousStorageKey: row.previous_storage_key ?? null,
    updatedAt: toIso(row.updated_at),
  }
}

export function createDb({ pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT, 10) || 5000,
}) } = {}) {
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
        RETURNING name, content_hash, tarball_hash, storage_key, previous_storage_key, updated_at
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

    async upsertLeaderboardEntry(entry) {
      const result = await pool.query(`
        INSERT INTO leaderboard_entries
          (user_id, handle, total_tokens, input_tokens, output_tokens, cache_read_tokens,
           cache_write_tokens, reasoning_tokens, total_cost_usd, event_count, active_days, top_model)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id) DO UPDATE
        SET handle = EXCLUDED.handle,
            total_tokens = EXCLUDED.total_tokens,
            input_tokens = EXCLUDED.input_tokens,
            output_tokens = EXCLUDED.output_tokens,
            cache_read_tokens = EXCLUDED.cache_read_tokens,
            cache_write_tokens = EXCLUDED.cache_write_tokens,
            reasoning_tokens = EXCLUDED.reasoning_tokens,
            total_cost_usd = EXCLUDED.total_cost_usd,
            event_count = EXCLUDED.event_count,
            active_days = EXCLUDED.active_days,
            top_model = EXCLUDED.top_model,
            submit_count = leaderboard_entries.submit_count + 1,
            updated_at = now()
        RETURNING user_id, handle, submit_count
      `, [
        entry.userId,
        entry.handle,
        entry.totalTokens,
        entry.inputTokens,
        entry.outputTokens,
        entry.cacheReadTokens,
        entry.cacheWriteTokens,
        entry.reasoningTokens,
        entry.totalCostUsd,
        entry.eventCount,
        entry.activeDays,
        normalizeNullableString(entry.topModel),
      ])
      const row = result.rows[0]
      return { userId: row.user_id, handle: row.handle, submitCount: row.submit_count }
    },

    async replaceLeaderboardDaily(userId, rows) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('DELETE FROM leaderboard_daily WHERE user_id = $1', [userId])
        for (const r of rows) {
          await client.query(
            'INSERT INTO leaderboard_daily (user_id, day, tokens, cost_usd) VALUES ($1, $2, $3, $4)',
            [userId, r.day, r.tokens, r.cost],
          )
        }
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    },

    async getEntryRank(userId, sort) {
      const column = LEADERBOARD_SORT_COLUMNS[sort] ?? LEADERBOARD_SORT_COLUMNS.tokens
      const result = await pool.query(`
        SELECT rank FROM (
          SELECT user_id, ROW_NUMBER() OVER (ORDER BY ${column} DESC, updated_at ASC) AS rank
          FROM leaderboard_entries
        ) ranked
        WHERE user_id = $1
      `, [userId])
      const rank = result.rows[0]?.rank
      return rank != null ? Number(rank) : null
    },

    async listLeaderboard({ sort = 'tokens', limit = 50, offset = 0 } = {}) {
      const column = LEADERBOARD_SORT_COLUMNS[sort] ?? LEADERBOARD_SORT_COLUMNS.tokens
      const result = await pool.query(`
        SELECT user_id, handle, total_tokens, input_tokens, output_tokens, cache_read_tokens,
               cache_write_tokens, reasoning_tokens, total_cost_usd, event_count, active_days,
               top_model, submit_count, updated_at,
               ROW_NUMBER() OVER (ORDER BY ${column} DESC, updated_at ASC) AS rank
        FROM leaderboard_entries
        ORDER BY ${column} DESC, updated_at ASC
        LIMIT $1 OFFSET $2
      `, [limit, offset])
      return result.rows.map(mapLeaderboardRow)
    },

    async getLeaderboardAggregates() {
      const result = await pool.query(`
        SELECT COUNT(*)::int AS user_count,
               COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
               COALESCE(SUM(total_cost_usd), 0) AS total_cost_usd
        FROM leaderboard_entries
      `)
      const row = result.rows[0]
      return {
        userCount: row.user_count,
        totalTokens: Number(row.total_tokens),
        totalCostUsd: row.total_cost_usd,
      }
    },

    // Windowed ranking over the last `days` days, computed from leaderboard_daily.
    async listLeaderboardWindowed({ sort = 'tokens', days = 30, limit = 50, offset = 0 } = {}) {
      const column = LEADERBOARD_WINDOW_COLUMNS[sort] ?? LEADERBOARD_WINDOW_COLUMNS.tokens
      const result = await pool.query(`
        SELECT *, ROW_NUMBER() OVER (ORDER BY ${column} DESC, updated_at ASC) AS rank
        FROM (
          SELECT e.user_id, e.handle, e.submit_count, e.top_model, e.updated_at,
                 COALESCE(SUM(d.tokens), 0)::bigint AS total_tokens,
                 COALESCE(SUM(d.cost_usd), 0) AS total_cost_usd,
                 COUNT(d.day) FILTER (WHERE d.tokens > 0)::int AS active_days
          FROM leaderboard_entries e
          JOIN leaderboard_daily d ON d.user_id = e.user_id
          WHERE d.day >= CURRENT_DATE - ($1::int - 1)
          GROUP BY e.user_id, e.handle, e.submit_count, e.top_model, e.updated_at
        ) agg
        ORDER BY ${column} DESC, updated_at ASC
        LIMIT $2 OFFSET $3
      `, [days, limit, offset])
      return result.rows.map(mapWindowedRow)
    },

    async getLeaderboardAggregatesWindowed(days = 30) {
      const result = await pool.query(`
        SELECT COUNT(*)::int AS user_count,
               COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
               COALESCE(SUM(total_cost_usd), 0) AS total_cost_usd
        FROM (
          SELECT e.user_id,
                 COALESCE(SUM(d.tokens), 0) AS total_tokens,
                 COALESCE(SUM(d.cost_usd), 0) AS total_cost_usd
          FROM leaderboard_entries e
          JOIN leaderboard_daily d ON d.user_id = e.user_id
          WHERE d.day >= CURRENT_DATE - ($1::int - 1)
          GROUP BY e.user_id
        ) agg
      `, [days])
      const row = result.rows[0]
      return {
        userCount: row.user_count,
        totalTokens: Number(row.total_tokens),
        totalCostUsd: row.total_cost_usd,
      }
    },

    async getLeaderboardDailyByHandle(handle) {
      const result = await pool.query(`
        SELECT d.day, d.tokens, d.cost_usd
        FROM leaderboard_daily d
        JOIN leaderboard_entries e ON e.user_id = d.user_id
        WHERE lower(e.handle) = lower($1)
        ORDER BY d.day ASC
      `, [handle])
      return result.rows.map((r) => ({
        day: toIsoDate(r.day),
        tokens: Number(r.tokens),
        cost: r.cost_usd,
      }))
    },

    async replaceLeaderboardModels(userId, rows) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('DELETE FROM leaderboard_models WHERE user_id = $1', [userId])
        for (const r of rows) {
          await client.query(
            'INSERT INTO leaderboard_models (user_id, model, provider, tokens, cost_usd, event_count) VALUES ($1, $2, $3, $4, $5, $6)',
            [userId, r.model, normalizeNullableString(r.provider), r.tokens, r.cost, r.eventCount],
          )
        }
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    },

    async getLeaderboardModelsByHandle(handle) {
      const result = await pool.query(`
        SELECT m.model, m.provider, m.tokens, m.cost_usd, m.event_count
        FROM leaderboard_models m
        JOIN leaderboard_entries e ON e.user_id = m.user_id
        WHERE lower(e.handle) = lower($1)
        ORDER BY m.tokens DESC
      `, [handle])
      return result.rows.map((r) => ({
        model: r.model,
        provider: r.provider ?? null,
        tokens: Number(r.tokens),
        cost: r.cost_usd,
        eventCount: Number(r.event_count),
      }))
    },

    async deleteLeaderboardEntry(userId) {
      await pool.query('DELETE FROM leaderboard_entries WHERE user_id = $1', [userId])
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
export const upsertLeaderboardEntry = db.upsertLeaderboardEntry
export const replaceLeaderboardDaily = db.replaceLeaderboardDaily
export const getEntryRank = db.getEntryRank
export const listLeaderboard = db.listLeaderboard
export const getLeaderboardAggregates = db.getLeaderboardAggregates
export const listLeaderboardWindowed = db.listLeaderboardWindowed
export const getLeaderboardAggregatesWindowed = db.getLeaderboardAggregatesWindowed
export const getLeaderboardDailyByHandle = db.getLeaderboardDailyByHandle
export const replaceLeaderboardModels = db.replaceLeaderboardModels
export const getLeaderboardModelsByHandle = db.getLeaderboardModelsByHandle
export const deleteLeaderboardEntry = db.deleteLeaderboardEntry
