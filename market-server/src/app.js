import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import { createGunzip } from 'node:zlib'
import { extract as tarExtract } from 'tar-stream'
import yaml from 'js-yaml'

import * as defaultDb from './db.js'
import * as defaultStorage from './storage.js'
import * as defaultAuth from './auth.js'

const SKILL_NAME_PATTERN = /^(?!.*\.\.)[A-Za-z0-9._-]+$/

export function isValidSkillName(name) {
  return typeof name === 'string' && SKILL_NAME_PATTERN.test(name)
}

function nullableFrontmatterString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function extractFrontmatter(markdown) {
  const normalized = markdown.replace(/^\uFEFF/, '')
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) {
    return {}
  }
  return yaml.load(match[1]) ?? {}
}

async function extractSkillFrontmatter(name, tarball) {
  const text = await extractSkillMarkdown(name, tarball)
  return extractFrontmatter(text)
}

async function extractSkillMarkdown(name, tarball) {
  const expectedPath = `${name}/SKILL.md`

  return new Promise((resolve, reject) => {
    const extract = tarExtract()
    let found = false
    let settled = false

    function finish(value) {
      if (!settled) {
        settled = true
        resolve(value)
      }
    }

    function fail(error) {
      if (!settled) {
        settled = true
        reject(error)
      }
    }

    extract.on('entry', (header, stream, next) => {
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => {
        if (header.name === expectedPath) {
          found = true
          finish(Buffer.concat(chunks).toString('utf8'))
        }
        next()
      })
      stream.on('error', fail)
      stream.resume()
    })
    extract.on('finish', () => {
      if (!found) {
        fail(new Error(`${expectedPath} not found in package`))
      }
    })
    extract.on('error', fail)

    const gunzip = createGunzip()
    gunzip.on('error', fail)
    gunzip.pipe(extract)
    gunzip.end(tarball)
  })
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

function badRequest(reply, message) {
  return reply.code(400).send({ error: message })
}

const HANDLE_PATTERN = /^[A-Za-z0-9_-]{2,32}$/
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const LEADERBOARD_SORTS = new Set(['tokens', 'cost', 'active_days'])
const LEADERBOARD_WINDOWS = new Set([7, 30, 60, 90])
const MAX_DAILY_ENTRIES = 800
const MAX_MODEL_ENTRIES = 200

function isNonNegativeFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function userFromBearer(auth, header) {
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    try {
      return auth.verifyToken(header.slice(7))
    } catch {
      return null
    }
  }
  return null
}

export async function createApp({ db = defaultDb, storage = defaultStorage, auth = defaultAuth, randomUuid = randomUUID } = {}) {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } })

  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    timeWindow: '1 minute',
  })

  const corsOrigin = process.env.CORS_ORIGIN
  await fastify.register(cors, corsOrigin
    ? { origin: corsOrigin.split(',').map(s => s.trim()) }
    : { origin: true }
  )
  await fastify.register(multipart, {
    limits: {
      fileSize: (parseInt(process.env.UPLOAD_MAX_SIZE_MB, 10) || 10) * 1024 * 1024,
      files: 1,
    },
  })

  fastify.get('/health', async () => ({ status: 'ok' }))

  const authRateLimit = {
    rateLimit: {
      max: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 5,
      timeWindow: `${parseInt(process.env.RATE_LIMIT_AUTH_WINDOW, 10) || 15} minutes`,
    },
  }

  const refreshRateLimit = {
    rateLimit: {
      max: parseInt(process.env.RATE_LIMIT_REFRESH_MAX, 10) || 30,
      timeWindow: `${parseInt(process.env.RATE_LIMIT_REFRESH_WINDOW, 10) || 15} minutes`,
    },
  }

  fastify.post('/auth/register', { config: authRateLimit }, async (request, reply) => {
    const { email, password } = request.body ?? {}
    if (!email || typeof email !== 'string' || email.trim() === '') {
      return badRequest(reply, 'email is required')
    }
    if (!password || typeof password !== 'string' || password.trim() === '') {
      return badRequest(reply, 'password is required')
    }
    if (password.length < 8) {
      return badRequest(reply, 'password must be at least 8 characters')
    }
    const passwordHash = await auth.hashPassword(password)
    let user
    try {
      user = await db.createUser({ email: email.trim(), passwordHash })
    } catch (err) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'email already registered' })
      }
      throw err
    }
    const accessToken = auth.signToken({ sub: user.id, email: user.email })
    const refreshToken = auth.generateRefreshToken()
    const tokenHash = auth.hashRefreshToken(refreshToken)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await db.createRefreshToken({ userId: user.id, tokenHash, expiresAt })
    return { accessToken, refreshToken, email: user.email }
  })

  fastify.post('/auth/login', { config: authRateLimit }, async (request, reply) => {
    const { email, password } = request.body ?? {}
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return reply.code(401).send({ error: 'invalid credentials' })
    }
    const user = await db.getUserByEmail(email.trim())
    if (!user) {
      return reply.code(401).send({ error: 'invalid credentials' })
    }
    const valid = await auth.comparePassword(password, user.password_hash)
    if (!valid) {
      return reply.code(401).send({ error: 'invalid credentials' })
    }
    const accessToken = auth.signToken({ sub: user.id, email: user.email })
    const refreshToken = auth.generateRefreshToken()
    const tokenHash = auth.hashRefreshToken(refreshToken)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await db.createRefreshToken({ userId: user.id, tokenHash, expiresAt })
    return { accessToken, refreshToken, email: user.email }
  })

  fastify.post('/auth/refresh', { config: refreshRateLimit }, async (request, reply) => {
    const { refreshToken } = request.body ?? {}
    if (!refreshToken || typeof refreshToken !== 'string') {
      return reply.code(401).send({ error: 'refresh token is required' })
    }
    const tokenHash = auth.hashRefreshToken(refreshToken)
    const stored = await db.findRefreshToken(tokenHash)
    if (!stored) {
      return reply.code(401).send({ error: 'invalid refresh token' })
    }
    if (new Date(stored.expires_at) <= new Date()) {
      await db.deleteRefreshToken(tokenHash)
      return reply.code(401).send({ error: 'refresh token expired' })
    }
    await db.deleteRefreshToken(tokenHash)
    const accessToken = auth.signToken({ sub: stored.user_id, email: stored.email })
    const newRefreshToken = auth.generateRefreshToken()
    const newTokenHash = auth.hashRefreshToken(newRefreshToken)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await db.createRefreshToken({ userId: stored.user_id, tokenHash: newTokenHash, expiresAt })
    return { accessToken, refreshToken: newRefreshToken, email: stored.email }
  })

  fastify.post('/auth/logout', async (request, reply) => {
    const { refreshToken } = request.body ?? {}
    if (refreshToken && typeof refreshToken === 'string') {
      const tokenHash = auth.hashRefreshToken(refreshToken)
      await db.deleteRefreshToken(tokenHash)
      return { success: true }
    }
    const header = request.headers.authorization
    if (header && header.startsWith('Bearer ')) {
      try {
        const payload = auth.verifyToken(header.slice(7))
        await db.deleteAllRefreshTokens(payload.sub)
      } catch {
        // invalid token — still return 200
      }
    }
    return { success: true }
  })

  fastify.get('/api/skills', async (request) => {
    const skills = await db.listSkills()
    let userEmail = null
    const header = request.headers.authorization
    if (header && header.startsWith('Bearer ')) {
      try {
        const payload = auth.verifyToken(header.slice(7))
        userEmail = payload.email
      } catch {
        // invalid/expired token — treat as unauthenticated
      }
    }
    return skills.map((s) => ({
      ...s,
      author: s.author != null && s.author.includes('@') ? s.author.split('@')[0] : s.author,
      isOwner: userEmail != null && s.author === userEmail,
    }))
  })

  fastify.get('/api/skills/:name/skill-md', async (request, reply) => {
    const { name } = request.params
    if (!isValidSkillName(name)) {
      return badRequest(reply, 'invalid skill name')
    }
    const skill = await db.getSkill(name)
    if (!skill) {
      return reply.code(404).send({ error: 'skill not found' })
    }
    if (skill.deleted_at !== null && skill.deleted_at !== undefined) {
      return reply.code(410).send({ error: 'skill deleted' })
    }
    const stream = await storage.getObjectStream(skill.storage_key)
    const tarball = await streamToBuffer(stream)
    let markdown
    try {
      markdown = await extractSkillMarkdown(name, tarball)
    } catch (error) {
      return reply.code(500).send({ error: error.message })
    }
    reply.header('content-type', 'text/markdown; charset=utf-8')
    return markdown
  })

  fastify.get('/api/skills/:name/download', async (request, reply) => {
    const { name } = request.params
    if (!isValidSkillName(name)) {
      return badRequest(reply, 'invalid skill name')
    }

    const skill = await db.getSkill(name)
    if (!skill) {
      return reply.code(404).send({ error: 'skill not found' })
    }
    if (skill.deleted_at !== null && skill.deleted_at !== undefined) {
      return reply.code(410).send({ error: 'skill deleted' })
    }

    reply.header('content-type', 'application/gzip')
    reply.header('content-disposition', `attachment; filename="${name}.tar.gz"`)
    return reply.send(await storage.getObjectStream(skill.storage_key))
  })

  fastify.put('/api/skills/:name', { onRequest: auth.requireAuth }, async (request, reply) => {
    const { name } = request.params
    if (!isValidSkillName(name)) {
      return badRequest(reply, 'invalid skill name')
    }

    const contentHash = request.headers['x-content-hash']
    if (typeof contentHash !== 'string' || contentHash.trim() === '') {
      return badRequest(reply, 'x-content-hash is required')
    }
    if (!/^[0-9a-f]{64}$/i.test(contentHash.trim())) {
      return badRequest(reply, 'invalid content hash format')
    }

    const existing = await db.getSkill(name)
    if (existing && existing.author && existing.author !== request.user.email && existing.deleted_at === null) {
      return reply.code(403).send({ error: 'you are not the author of this skill' })
    }

    const file = await request.file()
    if (!file || file.fieldname !== 'package') {
      return badRequest(reply, 'multipart field "package" is required')
    }

    const tarball = await file.toBuffer()
    let frontmatter
    try {
      frontmatter = await extractSkillFrontmatter(name, tarball)
    } catch (error) {
      return badRequest(reply, error.message)
    }

    const tarballHash = createHash('sha256').update(tarball).digest('hex')
    const storageKey = `${name}/${randomUuid()}.tar.gz`
    await storage.putObject(storageKey, tarball)
    const saved = await db.upsertSkill({
      name,
      version: nullableFrontmatterString(frontmatter.version),
      description: nullableFrontmatterString(frontmatter.description),
      contentHash: contentHash.trim(),
      tarballHash,
      storageKey,
      author: request.user.email,
      updatedBy: request.user.email,
      updatedIp: request.ip,
    })

    if (saved.previousStorageKey) {
      try {
        await storage.deleteObject(saved.previousStorageKey)
      } catch (err) {
        request.log.warn({ err, key: saved.previousStorageKey }, 'failed to delete previous storage object')
      }
    }

    return {
      name: saved.name,
      contentHash: saved.contentHash,
      tarballHash: saved.tarballHash,
      storageKey: saved.storageKey,
      updatedAt: saved.updatedAt,
    }
  })

  fastify.delete('/api/skills/:name', { onRequest: auth.requireAuth }, async (request, reply) => {
    const { name } = request.params
    if (!isValidSkillName(name)) {
      return badRequest(reply, 'invalid skill name')
    }

    const skill = await db.getSkill(name)
    if (!skill) {
      return reply.code(404).send({ error: 'skill not found' })
    }
    if (skill.author && skill.author !== request.user.email) {
      return reply.code(403).send({
        error: `this skill was published by ${skill.author}, only the original author can delete it`,
      })
    }

    const result = await db.softDeleteSkill(name)
    if (result === 'not_found') {
      return reply.code(404).send({ error: 'skill not found' })
    }

    if (skill.storage_key) {
      try {
        await storage.deleteObject(skill.storage_key)
      } catch (err) {
        request.log.warn({ err, key: skill.storage_key }, 'failed to delete storage object on soft delete')
      }
    }

    return reply.code(204).send()
  })

  const submitRateLimit = {
    rateLimit: {
      max: parseInt(process.env.RATE_LIMIT_LEADERBOARD_SUBMIT_MAX, 10) || 10,
      timeWindow: `${parseInt(process.env.RATE_LIMIT_LEADERBOARD_SUBMIT_WINDOW, 10) || 60} minutes`,
    },
  }

  fastify.post('/api/leaderboard/submit', { onRequest: auth.requireAuth, config: submitRateLimit }, async (request, reply) => {
    const { handle, summary, daily, models } = request.body ?? {}

    if (typeof handle !== 'string' || !HANDLE_PATTERN.test(handle)) {
      return badRequest(reply, 'invalid handle')
    }
    if (typeof summary !== 'object' || summary === null) {
      return badRequest(reply, 'summary is required')
    }
    const tokenFields = [
      'inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens',
    ]
    for (const field of [...tokenFields, 'totalCostUsd', 'eventCount']) {
      if (!isNonNegativeFinite(summary[field])) {
        return badRequest(reply, `invalid summary.${field}`)
      }
    }
    if (summary.topModel != null && typeof summary.topModel !== 'string') {
      return badRequest(reply, 'invalid summary.topModel')
    }
    if (!Array.isArray(daily) || daily.length > MAX_DAILY_ENTRIES) {
      return badRequest(reply, 'invalid daily series')
    }
    for (const row of daily) {
      if (typeof row !== 'object' || row === null
        || typeof row.day !== 'string' || !DAY_PATTERN.test(row.day)
        || !isNonNegativeFinite(row.tokens) || !isNonNegativeFinite(row.cost)) {
        return badRequest(reply, 'invalid daily entry')
      }
    }

    const modelList = models ?? []
    if (!Array.isArray(modelList) || modelList.length > MAX_MODEL_ENTRIES) {
      return badRequest(reply, 'invalid models list')
    }
    for (const row of modelList) {
      if (typeof row !== 'object' || row === null
        || typeof row.model !== 'string' || row.model.trim() === ''
        || (row.provider != null && typeof row.provider !== 'string')
        || !isNonNegativeFinite(row.tokens) || !isNonNegativeFinite(row.cost)
        || !isNonNegativeFinite(row.eventCount)) {
        return badRequest(reply, 'invalid model entry')
      }
    }

    const totalTokens = tokenFields.reduce((sum, field) => sum + summary[field], 0)
    const activeDays = daily.filter((row) => row.tokens > 0).length

    let saved
    try {
      saved = await db.upsertLeaderboardEntry({
        userId: request.user.sub,
        handle,
        totalTokens,
        inputTokens: summary.inputTokens,
        outputTokens: summary.outputTokens,
        cacheReadTokens: summary.cacheReadTokens,
        cacheWriteTokens: summary.cacheWriteTokens,
        reasoningTokens: summary.reasoningTokens,
        totalCostUsd: summary.totalCostUsd,
        eventCount: summary.eventCount,
        activeDays,
        topModel: summary.topModel ?? null,
      })
    } catch (err) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'handle already taken' })
      }
      throw err
    }

    await db.replaceLeaderboardDaily(request.user.sub, daily.map((row) => ({
      day: row.day,
      tokens: row.tokens,
      cost: row.cost,
    })))

    await db.replaceLeaderboardModels(request.user.sub, modelList.map((row) => ({
      model: row.model,
      provider: row.provider ?? null,
      tokens: row.tokens,
      cost: row.cost,
      eventCount: row.eventCount,
    })))

    const rank = await db.getEntryRank(request.user.sub, 'tokens')
    return { rank, submitCount: saved.submitCount }
  })

  fastify.get('/api/leaderboard', async (request) => {
    const sortParam = request.query?.sort
    const sort = LEADERBOARD_SORTS.has(sortParam) ? sortParam : 'tokens'
    const limit = Math.min(Math.max(parseInt(request.query?.limit, 10) || 50, 1), 200)
    const offset = Math.max(parseInt(request.query?.offset, 10) || 0, 0)
    const days = parseInt(request.query?.days, 10)
    const windowed = LEADERBOARD_WINDOWS.has(days)

    const [entries, aggregates] = windowed
      ? await Promise.all([
          db.listLeaderboardWindowed({ sort, days, limit, offset }),
          db.getLeaderboardAggregatesWindowed(days),
        ])
      : await Promise.all([
          db.listLeaderboard({ sort, limit, offset }),
          db.getLeaderboardAggregates(),
        ])
    const caller = userFromBearer(auth, request.headers.authorization)

    return {
      entries: entries.map(({ userId, ...entry }) => ({
        ...entry,
        isMe: caller != null && userId === caller.sub,
      })),
      aggregates,
    }
  })

  fastify.get('/api/leaderboard/:handle/daily', async (request, reply) => {
    const { handle } = request.params
    if (typeof handle !== 'string' || !HANDLE_PATTERN.test(handle)) {
      return badRequest(reply, 'invalid handle')
    }
    return db.getLeaderboardDailyByHandle(handle)
  })

  fastify.get('/api/leaderboard/:handle/models', async (request, reply) => {
    const { handle } = request.params
    if (typeof handle !== 'string' || !HANDLE_PATTERN.test(handle)) {
      return badRequest(reply, 'invalid handle')
    }
    return db.getLeaderboardModelsByHandle(handle)
  })

  fastify.delete('/api/leaderboard/me', { onRequest: auth.requireAuth }, async (request, reply) => {
    await db.deleteLeaderboardEntry(request.user.sub)
    return reply.code(204).send()
  })

  return fastify
}
