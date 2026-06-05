import { Client } from 'minio'

function requireEnv(env, key) {
  const value = env[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required`)
  }
  return value.trim()
}

function parseMinioEndpoint(endpoint) {
  let url
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error('MINIO_ENDPOINT must be a valid http(s) URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('MINIO_ENDPOINT must start with http:// or https://')
  }

  return {
    endPoint: url.hostname,
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
    useSSL: url.protocol === 'https:',
  }
}

export function createStorage({ env = process.env, ClientCtor = Client } = {}) {
  const endpoint = parseMinioEndpoint(requireEnv(env, 'MINIO_ENDPOINT'))
  const bucket = requireEnv(env, 'MINIO_BUCKET')
  const client = new ClientCtor({
    ...endpoint,
    accessKey: requireEnv(env, 'MINIO_ACCESS_KEY'),
    secretKey: requireEnv(env, 'MINIO_SECRET_KEY'),
  })

  return {
    async ensureBucket() {
      const exists = await client.bucketExists(bucket)
      if (!exists) {
        await client.makeBucket(bucket)
      }
    },

    async putObject(key, buffer) {
      await client.putObject(bucket, key, buffer, buffer.length)
    },

    async getObjectStream(key) {
      return client.getObject(bucket, key)
    },

    async deleteObject(key) {
      await client.removeObject(bucket, key)
    },
  }
}

let defaultStorage

function getDefaultStorage() {
  defaultStorage ??= createStorage()
  return defaultStorage
}

export async function ensureBucket() {
  return getDefaultStorage().ensureBucket()
}

export async function putObject(key, buffer) {
  return getDefaultStorage().putObject(key, buffer)
}

export async function getObjectStream(key) {
  return getDefaultStorage().getObjectStream(key)
}

export async function deleteObject(key) {
  return getDefaultStorage().deleteObject(key)
}
