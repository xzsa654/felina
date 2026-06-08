import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createDb } from './db.js'

test('listSkills returns live skill rows in API shape', async () => {
  const pool = {
    queries: [],
    async query(sql, params) {
      this.queries.push([sql, params])
      return {
        rows: [
          {
            name: 'code-review',
            version: '1.0.0',
            description: 'Automated review',
            content_hash: 'content-a',
            updated_at: new Date('2026-06-05T07:00:00Z'),
            author: 'alice@corp.local',
          },
        ],
      }
    },
  }

  const db = createDb({ pool })

  assert.deepEqual(await db.listSkills(), [
    {
      name: 'code-review',
      version: '1.0.0',
      description: 'Automated review',
      contentHash: 'content-a',
      updatedAt: '2026-06-05T07:00:00.000Z',
      author: 'alice@corp.local',
    },
  ])
  assert.match(pool.queries[0][0], /WHERE deleted_at IS NULL/)
})

test('upsertSkill overwrites by name and preserves previous storage key', async () => {
  const pool = {
    async query(sql, params) {
      assert.match(sql, /ON CONFLICT \(name\) DO UPDATE/)
      assert.match(sql, /previous_storage_key = skills\.storage_key/)
      assert.match(sql, /deleted_at = NULL/)
      assert.deepEqual(params, [
        'code-review',
        '1.0.0',
        null,
        'content-a',
        'tar-a',
        'code-review/uuid.tar.gz',
        'alice@corp.local',
        'alice@corp.local',
        '127.0.0.1',
      ])
      return {
        rows: [
          {
            name: 'code-review',
            content_hash: 'content-a',
            tarball_hash: 'tar-a',
            storage_key: 'code-review/uuid.tar.gz',
            updated_at: new Date('2026-06-05T07:00:00Z'),
          },
        ],
      }
    },
  }

  const db = createDb({ pool })

  assert.deepEqual(await db.upsertSkill({
    name: 'code-review',
    version: '1.0.0',
    description: '',
    contentHash: 'content-a',
    tarballHash: 'tar-a',
    storageKey: 'code-review/uuid.tar.gz',
    author: 'alice@corp.local',
    updatedBy: 'alice@corp.local',
    updatedIp: '127.0.0.1',
  }), {
    name: 'code-review',
    contentHash: 'content-a',
    tarballHash: 'tar-a',
    storageKey: 'code-review/uuid.tar.gz',
    previousStorageKey: null,
    updatedAt: '2026-06-05T07:00:00.000Z',
  })
})

test('softDeleteSkill classifies updated, already_deleted, and not_found', async () => {
  const outcomes = [
    { update: { rowCount: 1 }, select: null, expected: 'updated' },
    { update: { rowCount: 0 }, select: { rows: [{ deleted_at: new Date() }] }, expected: 'already_deleted' },
    { update: { rowCount: 0 }, select: { rows: [] }, expected: 'not_found' },
  ]

  for (const outcome of outcomes) {
    const pool = {
      calls: 0,
      async query() {
        this.calls += 1
        return this.calls === 1 ? outcome.update : outcome.select
      },
    }
    const db = createDb({ pool })
    assert.equal(await db.softDeleteSkill('code-review'), outcome.expected)
  }
})
