import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import { createGunzip } from 'node:zlib'
import { extract as tarExtract } from 'tar-stream'
import yaml from 'js-yaml'

import * as defaultDb from './db.js'
import * as defaultStorage from './storage.js'

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

export function createApp({ db = defaultDb, storage = defaultStorage, randomUuid = randomUUID } = {}) {
  const fastify = Fastify({ logger: true })

  fastify.register(cors)
  fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 1,
    },
  })

  fastify.get('/health', async () => ({ status: 'ok' }))

  fastify.get('/api/skills', async () => db.listSkills())

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

  fastify.put('/api/skills/:name', async (request, reply) => {
    const { name } = request.params
    if (!isValidSkillName(name)) {
      return badRequest(reply, 'invalid skill name')
    }

    const contentHash = request.headers['x-content-hash']
    if (typeof contentHash !== 'string' || contentHash.trim() === '') {
      return badRequest(reply, 'x-content-hash is required')
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
    })

    return {
      name: saved.name,
      contentHash: saved.contentHash,
      tarballHash: saved.tarballHash,
      storageKey: saved.storageKey,
      updatedAt: saved.updatedAt,
    }
  })

  fastify.delete('/api/skills/:name', async (request, reply) => {
    const { name } = request.params
    if (!isValidSkillName(name)) {
      return badRequest(reply, 'invalid skill name')
    }

    const result = await db.softDeleteSkill(name)
    if (result === 'not_found') {
      return reply.code(404).send({ error: 'skill not found' })
    }
    return reply.code(204).send()
  })

  return fastify
}
