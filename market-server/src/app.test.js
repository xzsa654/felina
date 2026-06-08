import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createGzip } from 'node:zlib'
import { pack as tarPack } from 'tar-stream'

import { createApp } from './app.js'
import { signToken, hashPassword, generateRefreshToken, hashRefreshToken, verifyToken } from './auth.js'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key'

function authHeader(email = 'alice@corp.local', sub = '00000000-0000-4000-8000-000000000001') {
  const token = signToken({ sub, email })
  return { authorization: `Bearer ${token}` }
}

async function createTarGz(entries) {
  const pack = tarPack()
  const chunks = []
  const gzip = createGzip()
  const done = new Promise((resolve, reject) => {
    gzip.on('data', (chunk) => chunks.push(chunk))
    gzip.on('end', () => resolve(Buffer.concat(chunks)))
    gzip.on('error', reject)
    pack.on('error', reject)
  })
  pack.pipe(gzip)

  for (const [name, content] of entries) {
    const buffer = Buffer.from(content, 'utf8')
    pack.entry({ name, size: buffer.length }, buffer)
  }

  pack.finalize()
  return done
}

function multipartPayload(buffer) {
  const boundary = 'felina-test-boundary'
  return {
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="package"; filename="skill.tar.gz"\r\nContent-Type: application/gzip\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  }
}

test('GET /api/skills returns persisted skills from db helper', async () => {
  const app = await createApp({
    db: {
      async listSkills() {
        return [{ name: 'code-review', version: '1.0.0', description: 'Review', contentHash: 'abc', updatedAt: '2026-06-05T07:00:00.000Z', author: null }]
      },
    },
  })

  const response = await app.inject({ method: 'GET', url: '/api/skills' })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), [{ name: 'code-review', version: '1.0.0', description: 'Review', contentHash: 'abc', updatedAt: '2026-06-05T07:00:00.000Z', author: null, isOwner: false }])
})

test('GET /api/skills masks author email to username and sets isOwner false without auth', async () => {
  const app = await createApp({
    db: {
      async listSkills() {
        return [
          { name: 'skill-a', version: '1.0.0', description: 'A', contentHash: 'abc', updatedAt: '2026-06-05T07:00:00.000Z', author: 'alice@corp.local' },
          { name: 'skill-b', version: '1.0.0', description: 'B', contentHash: 'def', updatedAt: '2026-06-05T07:00:00.000Z', author: null },
        ]
      },
    },
  })
  const response = await app.inject({ method: 'GET', url: '/api/skills' })
  const skills = response.json()
  assert.equal(skills[0].author, 'alice')
  assert.equal(skills[0].isOwner, false)
  assert.equal(skills[1].author, null)
  assert.equal(skills[1].isOwner, false)
})

test('GET /api/skills sets isOwner true for authenticated author', async () => {
  const app = await createApp({
    db: {
      async listSkills() {
        return [
          { name: 'mine', version: '1.0.0', description: 'M', contentHash: 'abc', updatedAt: '2026-06-05T07:00:00.000Z', author: 'alice@corp.local' },
          { name: 'theirs', version: '1.0.0', description: 'T', contentHash: 'def', updatedAt: '2026-06-05T07:00:00.000Z', author: 'bob@corp.local' },
        ]
      },
    },
  })
  const response = await app.inject({
    method: 'GET', url: '/api/skills',
    headers: authHeader('alice@corp.local'),
  })
  const skills = response.json()
  assert.equal(skills[0].isOwner, true)
  assert.equal(skills[0].author, 'alice')
  assert.equal(skills[1].isOwner, false)
  assert.equal(skills[1].author, 'bob')
})

test('GET /api/skills/:name/download distinguishes missing, deleted, and live skills', async () => {
  const app = await createApp({
    db: {
      async getSkill(name) {
        if (name === 'missing') return null
        if (name === 'deleted') return { deleted_at: new Date(), storage_key: 'deleted/archive.tar.gz' }
        return { deleted_at: null, storage_key: 'code-review/archive.tar.gz' }
      },
    },
    storage: {
      async getObjectStream(key) {
        return key
      },
    },
  })

  assert.equal((await app.inject({ method: 'GET', url: '/api/skills/missing/download' })).statusCode, 404)
  assert.equal((await app.inject({ method: 'GET', url: '/api/skills/deleted/download' })).statusCode, 410)

  const live = await app.inject({ method: 'GET', url: '/api/skills/code-review/download' })
  assert.equal(live.statusCode, 200)
  assert.equal(live.headers['content-type'], 'application/gzip')
  assert.equal(live.headers['content-disposition'], 'attachment; filename="code-review.tar.gz"')
  assert.equal(live.body, 'code-review/archive.tar.gz')
})

test('PUT /api/skills/:name returns 401 without auth token', async () => {
  const app = await createApp({
    db: { async upsertSkill() {} },
    storage: { async putObject() {} },
  })
  const body = multipartPayload(Buffer.from('not-a-tarball'))
  const response = await app.inject({ method: 'PUT', url: '/api/skills/code-review', headers: { ...body.headers, 'x-content-hash': 'abc' }, payload: body.payload })
  assert.equal(response.statusCode, 401)
})

test('multipart upload defaults to 10MB limit', async () => {
  const app = await createApp({
    db: { async upsertSkill() {} },
    storage: { async putObject() {} },
  })
  const prev = process.env.UPLOAD_MAX_SIZE_MB
  delete process.env.UPLOAD_MAX_SIZE_MB
  try {
    const bigApp = await createApp({
      db: { async upsertSkill() {} },
      storage: { async putObject() {} },
    })
    const bigPayload = Buffer.alloc(11 * 1024 * 1024)
    const body = multipartPayload(bigPayload)
    const res = await bigApp.inject({
      method: 'PUT', url: '/api/skills/big-skill',
      headers: { ...body.headers, ...authHeader(), 'x-content-hash': 'a'.repeat(64) },
      payload: body.payload,
    })
    assert.equal(res.statusCode, 413)
  } finally {
    if (prev === undefined) delete process.env.UPLOAD_MAX_SIZE_MB
    else process.env.UPLOAD_MAX_SIZE_MB = prev
  }
})

test('PUT /api/skills/:name rejects invalid content hash format', async () => {
  const app = await createApp({
    db: { async upsertSkill() {} },
    storage: { async putObject() {} },
  })
  const body = multipartPayload(Buffer.from('not-a-tarball'))
  const res = await app.inject({
    method: 'PUT', url: '/api/skills/code-review',
    headers: { ...body.headers, ...authHeader(), 'x-content-hash': 'not-a-hash' },
    payload: body.payload,
  })
  assert.equal(res.statusCode, 400)
  assert.match(res.json().error, /invalid content hash format/)
})

test('PUT /api/skills/:name accepts valid 64-hex content hash', async () => {
  const tarball = await createTarGz([['code-review/SKILL.md', '---\nversion: 1.0.0\n---\n# test']])
  const body = multipartPayload(tarball)
  const validHash = 'a'.repeat(64)
  const app = await createApp({
    db: { async upsertSkill(v) { return { ...v, updatedAt: '2026-01-01' } } },
    storage: { async putObject() {} },
    randomUuid: () => '00000000-0000-4000-8000-000000000000',
  })
  const res = await app.inject({
    method: 'PUT', url: '/api/skills/code-review',
    headers: { ...body.headers, ...authHeader(), 'x-content-hash': validHash },
    payload: body.payload,
  })
  assert.equal(res.statusCode, 200)
})

test('PUT /api/skills/:name validates name and content hash before writes', async () => {
  const writes = []
  const app = await createApp({
    db: { async upsertSkill(value) { writes.push(['db', value]) } },
    storage: { async putObject(key, buffer) { writes.push(['storage', key, buffer]) } },
  })
  const body = multipartPayload(Buffer.from('not-a-tarball'))

  const invalidName = await app.inject({ method: 'PUT', url: '/api/skills/has%20space', headers: { ...body.headers, ...authHeader(), 'x-content-hash': 'abc' }, payload: body.payload })
  const missingHash = await app.inject({ method: 'PUT', url: '/api/skills/code-review', headers: { ...body.headers, ...authHeader() }, payload: body.payload })

  assert.equal(invalidName.statusCode, 400)
  assert.equal(missingHash.statusCode, 400)
  assert.deepEqual(writes, [])
})

test('PUT /api/skills/:name stores tarball and upserts frontmatter metadata', async () => {
  const tarball = await createTarGz([[
    'code-review/SKILL.md',
    `﻿---
version: 1.2.0
description: Automated code review skill
---

# code-review
`,
  ]])
  const body = multipartPayload(tarball)
  const writes = []
  const app = await createApp({
    db: {
      async upsertSkill(value) {
        writes.push(['db', value])
        return { ...value, updatedAt: '2026-06-05T07:00:00.000Z' }
      },
    },
    storage: {
      async putObject(key, buffer) {
        writes.push(['storage', key, buffer])
      },
    },
    randomUuid: () => '00000000-0000-4000-8000-000000000000',
  })

  const response = await app.inject({
    method: 'PUT',
    url: '/api/skills/code-review',
    headers: { ...body.headers, ...authHeader(), 'x-content-hash': 'a'.repeat(64) },
    payload: body.payload,
  })

  const tarballHash = createHash('sha256').update(tarball).digest('hex')
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    name: 'code-review',
    contentHash: 'a'.repeat(64),
    tarballHash,
    storageKey: 'code-review/00000000-0000-4000-8000-000000000000.tar.gz',
    updatedAt: '2026-06-05T07:00:00.000Z',
  })
  assert.deepEqual(writes[0], ['storage', 'code-review/00000000-0000-4000-8000-000000000000.tar.gz', tarball])
  const dbWrite = writes[1][1]
  assert.equal(dbWrite.name, 'code-review')
  assert.equal(dbWrite.version, '1.2.0')
  assert.equal(dbWrite.author, 'alice@corp.local')
  assert.equal(dbWrite.updatedBy, 'alice@corp.local')
})

test('PUT /api/skills/:name rejects packages without matching top-level SKILL.md', async () => {
  const tarball = await createTarGz([['other/SKILL.md', '# other']])
  const body = multipartPayload(tarball)
  const writes = []
  const app = await createApp({
    db: { async upsertSkill(value) { writes.push(['db', value]) } },
    storage: { async putObject(key, buffer) { writes.push(['storage', key, buffer]) } },
  })

  const response = await app.inject({
    method: 'PUT',
    url: '/api/skills/code-review',
    headers: { ...body.headers, ...authHeader(), 'x-content-hash': 'a'.repeat(64) },
    payload: body.payload,
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(writes, [])
})

test('DELETE /api/skills/:name returns 401 without auth token', async () => {
  const app = await createApp({
    db: { async getSkill() { return { author: null } }, async softDeleteSkill() { return 'updated' } },
  })
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/skills/code-review' })).statusCode, 401)
})

test('DELETE /api/skills/:name allows author to delete own skill', async () => {
  const app = await createApp({
    db: {
      async getSkill() { return { author: 'alice@corp.local', deleted_at: null } },
      async softDeleteSkill() { return 'updated' },
    },
  })
  const res = await app.inject({ method: 'DELETE', url: '/api/skills/code-review', headers: authHeader('alice@corp.local') })
  assert.equal(res.statusCode, 204)
})

test('DELETE /api/skills/:name returns 403 for non-author', async () => {
  const app = await createApp({
    db: {
      async getSkill() { return { author: 'alice@corp.local', deleted_at: null } },
      async softDeleteSkill() { return 'updated' },
    },
  })
  const res = await app.inject({ method: 'DELETE', url: '/api/skills/code-review', headers: authHeader('bob@corp.local') })
  assert.equal(res.statusCode, 403)
  assert.match(res.json().error, /alice@corp\.local/)
})

test('DELETE /api/skills/:name allows delete of legacy NULL author skill', async () => {
  const app = await createApp({
    db: {
      async getSkill() { return { author: null, deleted_at: null } },
      async softDeleteSkill() { return 'updated' },
    },
  })
  const res = await app.inject({ method: 'DELETE', url: '/api/skills/code-review', headers: authHeader('bob@corp.local') })
  assert.equal(res.statusCode, 204)
})

test('DELETE /api/skills/:name returns 404 for missing skill', async () => {
  const app = await createApp({
    db: {
      async getSkill() { return null },
      async softDeleteSkill() { return 'not_found' },
    },
  })
  const res = await app.inject({ method: 'DELETE', url: '/api/skills/missing', headers: authHeader() })
  assert.equal(res.statusCode, 404)
})

test('CORS rejects unknown origin when CORS_ORIGIN is set', async () => {
  const prev = process.env.CORS_ORIGIN
  process.env.CORS_ORIGIN = 'http://localhost:1420'
  try {
    const app = await createApp({ db: {} })
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'https://evil.example.com',
        'access-control-request-method': 'GET',
      },
    })
    assert.equal(res.headers['access-control-allow-origin'], undefined)
  } finally {
    if (prev === undefined) delete process.env.CORS_ORIGIN
    else process.env.CORS_ORIGIN = prev
  }
})

test('CORS allows listed origin when CORS_ORIGIN is set', async () => {
  const prev = process.env.CORS_ORIGIN
  process.env.CORS_ORIGIN = 'http://localhost:1420,http://localhost:3000'
  try {
    const app = await createApp({ db: {} })
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:1420' },
    })
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:1420')
  } finally {
    if (prev === undefined) delete process.env.CORS_ORIGIN
    else process.env.CORS_ORIGIN = prev
  }
})

test('rate limit returns 429 after exceeding global limit', async () => {
  const prev = process.env.RATE_LIMIT_MAX
  process.env.RATE_LIMIT_MAX = '2'
  try {
    const app = await createApp({ db: { async listSkills() { return [] } } })
    await app.inject({ method: 'GET', url: '/api/skills' })
    await app.inject({ method: 'GET', url: '/api/skills' })
    const res = await app.inject({ method: 'GET', url: '/api/skills' })
    assert.equal(res.statusCode, 429)
  } finally {
    if (prev === undefined) delete process.env.RATE_LIMIT_MAX
    else process.env.RATE_LIMIT_MAX = prev
  }
})

test('auth endpoints have stricter rate limit', async () => {
  const prevMax = process.env.RATE_LIMIT_AUTH_MAX
  const prevWindow = process.env.RATE_LIMIT_AUTH_WINDOW
  process.env.RATE_LIMIT_AUTH_MAX = '2'
  process.env.RATE_LIMIT_AUTH_WINDOW = '1'
  try {
    const app = await createApp({
      db: { async getUserByEmail() { return null } },
    })
    await app.inject({ method: 'POST', url: '/auth/login', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ email: 'a@b.c', password: 'x' }) })
    await app.inject({ method: 'POST', url: '/auth/login', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ email: 'a@b.c', password: 'x' }) })
    const res = await app.inject({ method: 'POST', url: '/auth/login', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ email: 'a@b.c', password: 'x' }) })
    assert.equal(res.statusCode, 429)
  } finally {
    if (prevMax === undefined) delete process.env.RATE_LIMIT_AUTH_MAX
    else process.env.RATE_LIMIT_AUTH_MAX = prevMax
    if (prevWindow === undefined) delete process.env.RATE_LIMIT_AUTH_WINDOW
    else process.env.RATE_LIMIT_AUTH_WINDOW = prevWindow
  }
})

test('CORS allows all origins when CORS_ORIGIN is not set', async () => {
  const prev = process.env.CORS_ORIGIN
  delete process.env.CORS_ORIGIN
  try {
    const app = await createApp({ db: {} })
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://any.example.com' },
    })
    assert.equal(res.headers['access-control-allow-origin'], 'https://any.example.com')
  } finally {
    if (prev === undefined) delete process.env.CORS_ORIGIN
    else process.env.CORS_ORIGIN = prev
  }
})

test('POST /auth/register returns accessToken, refreshToken, and email', async () => {
  let created = null
  let storedRefreshToken = null
  const app = await createApp({
    db: {
      async createUser(data) { created = data; return { id: 'test-uuid', email: data.email } },
      async createRefreshToken(data) { storedRefreshToken = data; return data },
    },
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: 'alice@corp.local', password: 'secret123' }),
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.email, 'alice@corp.local')
  assert.ok(body.accessToken)
  assert.ok(body.refreshToken)
  assert.equal(body.token, undefined)
  assert.ok(created.passwordHash)
  assert.notEqual(created.passwordHash, 'secret123')
  assert.ok(storedRefreshToken)
  assert.equal(storedRefreshToken.userId, 'test-uuid')
  assert.equal(storedRefreshToken.tokenHash, hashRefreshToken(body.refreshToken))
})

test('POST /auth/register returns 409 for duplicate email', async () => {
  const app = await createApp({
    db: {
      async createUser() { const err = new Error('unique'); err.code = '23505'; throw err },
    },
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: 'alice@corp.local', password: 'secret123' }),
  })
  assert.equal(res.statusCode, 409)
})

test('POST /auth/register returns 400 for short password', async () => {
  const app = await createApp({ db: {} })
  const res = await app.inject({
    method: 'POST', url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: 'alice@corp.local', password: 'short' }),
  })
  assert.equal(res.statusCode, 400)
  assert.match(res.json().error, /at least 8 characters/)
})

test('POST /auth/register accepts password with exactly 8 characters', async () => {
  const app = await createApp({
    db: {
      async createUser(data) { return { id: 'test-uuid', email: data.email } },
      async createRefreshToken() { return {} },
    },
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: 'alice@corp.local', password: '12345678' }),
  })
  assert.equal(res.statusCode, 200)
})

test('POST /auth/register returns 400 for empty fields', async () => {
  const app = await createApp({ db: {} })
  const res = await app.inject({
    method: 'POST', url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: '', password: '' }),
  })
  assert.equal(res.statusCode, 400)
})

test('POST /auth/login returns accessToken, refreshToken, and email', async () => {
  const hash = await hashPassword('secret123')
  let storedRefreshToken = null
  const app = await createApp({
    db: {
      async getUserByEmail(email) { return email === 'alice@corp.local' ? { id: 'test-uuid', email, password_hash: hash } : null },
      async createRefreshToken(data) { storedRefreshToken = data; return data },
    },
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: 'alice@corp.local', password: 'secret123' }),
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.email, 'alice@corp.local')
  assert.ok(body.accessToken)
  assert.ok(body.refreshToken)
  assert.equal(body.token, undefined)
  assert.ok(storedRefreshToken)
  assert.equal(storedRefreshToken.userId, 'test-uuid')
  assert.equal(storedRefreshToken.tokenHash, hashRefreshToken(body.refreshToken))
})

test('POST /auth/login returns 401 for wrong password', async () => {
  const hash = await hashPassword('secret123')
  const app = await createApp({
    db: {
      async getUserByEmail() { return { id: 'test-uuid', email: 'alice@corp.local', password_hash: hash } },
    },
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: 'alice@corp.local', password: 'wrong' }),
  })
  assert.equal(res.statusCode, 401)
})

test('generateRefreshToken returns a UUID v4 string', () => {
  const token = generateRefreshToken()
  assert.match(token, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('hashRefreshToken returns SHA-256 hex of the input', () => {
  const token = 'test-token-value'
  const hash = hashRefreshToken(token)
  const expected = createHash('sha256').update(token).digest('hex')
  assert.equal(hash, expected)
  assert.equal(hash.length, 64)
})

test('signToken uses ACCESS_TOKEN_EXPIRY env var', () => {
  const prev = process.env.ACCESS_TOKEN_EXPIRY
  process.env.ACCESS_TOKEN_EXPIRY = '30s'
  try {
    const token = signToken({ sub: 'test-uuid', email: 'test@test.com' })
    const payload = verifyToken(token)
    assert.ok(payload.exp - payload.iat <= 30)
  } finally {
    if (prev === undefined) delete process.env.ACCESS_TOKEN_EXPIRY
    else process.env.ACCESS_TOKEN_EXPIRY = prev
  }
})

test('signToken defaults to 15m expiry', () => {
  const prev = process.env.ACCESS_TOKEN_EXPIRY
  delete process.env.ACCESS_TOKEN_EXPIRY
  try {
    const token = signToken({ sub: 'test-uuid', email: 'test@test.com' })
    const payload = verifyToken(token)
    assert.equal(payload.exp - payload.iat, 900)
  } finally {
    if (prev === undefined) delete process.env.ACCESS_TOKEN_EXPIRY
    else process.env.ACCESS_TOKEN_EXPIRY = prev
  }
})

test('POST /auth/refresh returns new token pair for valid refresh token', async () => {
  const originalRefresh = generateRefreshToken()
  const originalHash = hashRefreshToken(originalRefresh)
  let deletedHash = null
  let storedNew = null
  const app = await createApp({
    db: {
      async findRefreshToken(hash) {
        if (hash === originalHash) {
          return { id: 'rt-1', user_id: 'test-uuid', token_hash: hash, expires_at: new Date(Date.now() + 86400000), email: 'alice@corp.local' }
        }
        return null
      },
      async deleteRefreshToken(hash) { deletedHash = hash },
      async createRefreshToken(data) { storedNew = data; return data },
    },
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/refresh',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ refreshToken: originalRefresh }),
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.ok(body.accessToken)
  assert.ok(body.refreshToken)
  assert.equal(body.email, 'alice@corp.local')
  assert.notEqual(body.refreshToken, originalRefresh)
  assert.equal(deletedHash, originalHash)
  assert.ok(storedNew)
  assert.equal(storedNew.tokenHash, hashRefreshToken(body.refreshToken))
})

test('POST /auth/refresh returns 401 for invalid refresh token', async () => {
  const app = await createApp({
    db: {
      async findRefreshToken() { return null },
    },
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/refresh',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ refreshToken: 'invalid-token' }),
  })
  assert.equal(res.statusCode, 401)
})

test('POST /auth/refresh returns 401 for expired refresh token', async () => {
  const expiredRefresh = generateRefreshToken()
  const app = await createApp({
    db: {
      async findRefreshToken(hash) {
        return { id: 'rt-1', user_id: 'test-uuid', token_hash: hash, expires_at: new Date(Date.now() - 1000), email: 'alice@corp.local' }
      },
      async deleteRefreshToken() {},
    },
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/refresh',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ refreshToken: expiredRefresh }),
  })
  assert.equal(res.statusCode, 401)
})

test('POST /auth/logout deletes specific refresh token when provided', async () => {
  let deletedHash = null
  const app = await createApp({
    db: {
      async deleteRefreshToken(hash) { deletedHash = hash },
    },
  })
  const token = generateRefreshToken()
  const res = await app.inject({
    method: 'POST', url: '/auth/logout',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ refreshToken: token }),
  })
  assert.equal(res.statusCode, 200)
  assert.equal(deletedHash, hashRefreshToken(token))
})

test('POST /auth/logout deletes all refresh tokens when no refreshToken but has Bearer', async () => {
  let deletedUserId = null
  const app = await createApp({
    db: {
      async deleteAllRefreshTokens(userId) { deletedUserId = userId },
    },
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/logout',
    headers: { 'content-type': 'application/json', ...authHeader('alice@corp.local', 'user-uuid-1') },
    payload: JSON.stringify({}),
  })
  assert.equal(res.statusCode, 200)
  assert.equal(deletedUserId, 'user-uuid-1')
})

test('PUT /api/skills/:name deletes previous storage object on upsert', async () => {
  const tarball = await createTarGz([['code-review/SKILL.md', '---\nversion: 1.0.0\n---\n# test']])
  const body = multipartPayload(tarball)
  let deletedKey = null
  const app = await createApp({
    db: {
      async upsertSkill(v) { return { ...v, previousStorageKey: 'code-review/old-uuid.tar.gz', updatedAt: '2026-01-01' } },
    },
    storage: {
      async putObject() {},
      async deleteObject(key) { deletedKey = key },
    },
    randomUuid: () => '00000000-0000-4000-8000-000000000000',
  })
  const res = await app.inject({
    method: 'PUT', url: '/api/skills/code-review',
    headers: { ...body.headers, ...authHeader(), 'x-content-hash': 'a'.repeat(64) },
    payload: body.payload,
  })
  assert.equal(res.statusCode, 200)
  assert.equal(deletedKey, 'code-review/old-uuid.tar.gz')
})

test('PUT /api/skills/:name does not delete when no previous storage key', async () => {
  const tarball = await createTarGz([['code-review/SKILL.md', '---\nversion: 1.0.0\n---\n# test']])
  const body = multipartPayload(tarball)
  let deletedKey = null
  const app = await createApp({
    db: {
      async upsertSkill(v) { return { ...v, previousStorageKey: null, updatedAt: '2026-01-01' } },
    },
    storage: {
      async putObject() {},
      async deleteObject(key) { deletedKey = key },
    },
    randomUuid: () => '00000000-0000-4000-8000-000000000000',
  })
  const res = await app.inject({
    method: 'PUT', url: '/api/skills/code-review',
    headers: { ...body.headers, ...authHeader(), 'x-content-hash': 'a'.repeat(64) },
    payload: body.payload,
  })
  assert.equal(res.statusCode, 200)
  assert.equal(deletedKey, null)
})

test('PUT /api/skills/:name succeeds even if previous object deletion fails', async () => {
  const tarball = await createTarGz([['code-review/SKILL.md', '---\nversion: 1.0.0\n---\n# test']])
  const body = multipartPayload(tarball)
  const app = await createApp({
    db: {
      async upsertSkill(v) { return { ...v, previousStorageKey: 'old-key', updatedAt: '2026-01-01' } },
    },
    storage: {
      async putObject() {},
      async deleteObject() { throw new Error('MinIO down') },
    },
    randomUuid: () => '00000000-0000-4000-8000-000000000000',
  })
  const res = await app.inject({
    method: 'PUT', url: '/api/skills/code-review',
    headers: { ...body.headers, ...authHeader(), 'x-content-hash': 'a'.repeat(64) },
    payload: body.payload,
  })
  assert.equal(res.statusCode, 200)
})

test('DELETE /api/skills/:name deletes storage object on soft delete', async () => {
  let deletedKey = null
  const app = await createApp({
    db: {
      async getSkill() { return { author: 'alice@corp.local', deleted_at: null, storage_key: 'code-review/uuid.tar.gz' } },
      async softDeleteSkill() { return 'updated' },
    },
    storage: {
      async deleteObject(key) { deletedKey = key },
    },
  })
  const res = await app.inject({ method: 'DELETE', url: '/api/skills/code-review', headers: authHeader('alice@corp.local') })
  assert.equal(res.statusCode, 204)
  assert.equal(deletedKey, 'code-review/uuid.tar.gz')
})

test('DELETE /api/skills/:name succeeds even if storage deletion fails', async () => {
  const app = await createApp({
    db: {
      async getSkill() { return { author: 'alice@corp.local', deleted_at: null, storage_key: 'code-review/uuid.tar.gz' } },
      async softDeleteSkill() { return 'updated' },
    },
    storage: {
      async deleteObject() { throw new Error('MinIO down') },
    },
  })
  const res = await app.inject({ method: 'DELETE', url: '/api/skills/code-review', headers: authHeader('alice@corp.local') })
  assert.equal(res.statusCode, 204)
})

test('POST /auth/login returns 401 for non-existent email', async () => {
  const app = await createApp({
    db: { async getUserByEmail() { return null } },
  })
  const res = await app.inject({
    method: 'POST', url: '/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: 'nobody@corp.local', password: 'secret' }),
  })
  assert.equal(res.statusCode, 401)
})
