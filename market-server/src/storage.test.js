import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createStorage } from './storage.js'

class FakeMinioClient {
  constructor(config) {
    this.config = config
    this.calls = []
    this.exists = false
  }

  async bucketExists(bucket) {
    this.calls.push(['bucketExists', bucket])
    return this.exists
  }

  async makeBucket(bucket) {
    this.calls.push(['makeBucket', bucket])
    this.exists = true
  }

  async putObject(bucket, key, buffer, size) {
    this.calls.push(['putObject', bucket, key, buffer.toString('utf8'), size])
  }

  getObject(bucket, key) {
    this.calls.push(['getObject', bucket, key])
    return { bucket, key }
  }

  async removeObject(bucket, key) {
    this.calls.push(['removeObject', bucket, key])
  }

  async setBucketPolicy(bucket, policy) {
    this.calls.push(['setBucketPolicy', bucket, policy])
  }
}

test('storage adapter provisions bucket and routes object operations', async () => {
  let client
  const storage = createStorage({
    env: {
      MINIO_ENDPOINT: 'http://minio:9000',
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin',
      MINIO_BUCKET: 'skills',
    },
    ClientCtor: class extends FakeMinioClient {
      constructor(config) {
        super(config)
        client = this
      }
    },
  })

  await storage.ensureBucket()
  await storage.putObject('code-review/archive.tar.gz', Buffer.from('pkg'))
  const stream = await storage.getObjectStream('code-review/archive.tar.gz')
  await storage.deleteObject('code-review/archive.tar.gz')

  assert.deepEqual(client.config, {
    endPoint: 'minio',
    port: 9000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
  })
  assert.equal(client.calls[0][0], 'bucketExists')
  assert.equal(client.calls[1][0], 'makeBucket')
  assert.equal(client.calls[2][0], 'setBucketPolicy')
  assert.equal(client.calls[2][1], 'skills')
  const policy = JSON.parse(client.calls[2][2])
  assert.equal(policy.Statement[0].Effect, 'Deny')
  assert.deepEqual(client.calls[3], ['putObject', 'skills', 'code-review/archive.tar.gz', 'pkg', 3])
  assert.deepEqual(client.calls[4], ['getObject', 'skills', 'code-review/archive.tar.gz'])
  assert.deepEqual(client.calls[5], ['removeObject', 'skills', 'code-review/archive.tar.gz'])
  assert.deepEqual(stream, { bucket: 'skills', key: 'code-review/archive.tar.gz' })
})
