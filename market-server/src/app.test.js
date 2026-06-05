import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createGzip } from 'node:zlib'
import { pack as tarPack } from 'tar-stream'

import { createApp } from './app.js'

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
  const app = createApp({
    db: {
      async listSkills() {
        return [{ name: 'code-review', version: '1.0.0', description: 'Review', contentHash: 'abc', updatedAt: '2026-06-05T07:00:00.000Z' }]
      },
    },
  })

  const response = await app.inject({ method: 'GET', url: '/api/skills' })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), [{ name: 'code-review', version: '1.0.0', description: 'Review', contentHash: 'abc', updatedAt: '2026-06-05T07:00:00.000Z' }])
})

test('GET /api/skills/:name/download distinguishes missing, deleted, and live skills', async () => {
  const app = createApp({
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

test('PUT /api/skills/:name validates name and content hash before writes', async () => {
  const writes = []
  const app = createApp({
    db: { async upsertSkill(value) { writes.push(['db', value]) } },
    storage: { async putObject(key, buffer) { writes.push(['storage', key, buffer]) } },
  })
  const body = multipartPayload(Buffer.from('not-a-tarball'))

  const invalidName = await app.inject({ method: 'PUT', url: '/api/skills/has%20space', headers: { ...body.headers, 'x-content-hash': 'abc' }, payload: body.payload })
  const missingHash = await app.inject({ method: 'PUT', url: '/api/skills/code-review', headers: body.headers, payload: body.payload })

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
  const app = createApp({
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
    headers: { ...body.headers, 'x-content-hash': 'content-abc' },
    payload: body.payload,
  })

  const tarballHash = createHash('sha256').update(tarball).digest('hex')
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    name: 'code-review',
    contentHash: 'content-abc',
    tarballHash,
    storageKey: 'code-review/00000000-0000-4000-8000-000000000000.tar.gz',
    updatedAt: '2026-06-05T07:00:00.000Z',
  })
  assert.deepEqual(writes[0], ['storage', 'code-review/00000000-0000-4000-8000-000000000000.tar.gz', tarball])
  assert.deepEqual(writes[1], ['db', {
    name: 'code-review',
    version: '1.2.0',
    description: 'Automated code review skill',
    contentHash: 'content-abc',
    tarballHash,
    storageKey: 'code-review/00000000-0000-4000-8000-000000000000.tar.gz',
  }])
})

test('PUT /api/skills/:name rejects packages without matching top-level SKILL.md', async () => {
  const tarball = await createTarGz([['other/SKILL.md', '# other']])
  const body = multipartPayload(tarball)
  const writes = []
  const app = createApp({
    db: { async upsertSkill(value) { writes.push(['db', value]) } },
    storage: { async putObject(key, buffer) { writes.push(['storage', key, buffer]) } },
  })

  const response = await app.inject({
    method: 'PUT',
    url: '/api/skills/code-review',
    headers: { ...body.headers, 'x-content-hash': 'content-abc' },
    payload: body.payload,
  })

  assert.equal(response.statusCode, 400)
  assert.deepEqual(writes, [])
})

test('DELETE /api/skills/:name maps soft delete helper result to status', async () => {
  const app = createApp({
    db: {
      async softDeleteSkill(name) {
        return name === 'missing' ? 'not_found' : 'updated'
      },
    },
  })

  assert.equal((await app.inject({ method: 'DELETE', url: '/api/skills/code-review' })).statusCode, 204)
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/skills/missing' })).statusCode, 404)
})
