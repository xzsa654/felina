import Fastify from 'fastify'
import cors from '@fastify/cors'
import { createGzip } from 'zlib'
import { pack as tarPack } from 'tar-stream'
import { PassThrough } from 'stream'

const fastify = Fastify({ logger: true })
await fastify.register(cors)

const SKILLS = [
  { id: '1', name: 'code-review', description: 'Automated code review skill', author: 'felina-team', version: '1.0.0', contentHash: 'mock-hash-code-review-1.0.0' },
  { id: '2', name: 'test-generator', description: 'Generate unit tests from source code', author: 'felina-team', version: '0.9.0', contentHash: 'mock-hash-test-generator-0.9.0' },
  { id: '3', name: 'doc-writer', description: 'Generate documentation from code comments', author: 'felina-team', version: '1.2.0', contentHash: 'mock-hash-doc-writer-1.2.0' },
]

fastify.get('/health', async () => ({ status: 'ok' }))

fastify.get('/api/skills', async () => SKILLS)

fastify.get('/api/skills/:id/download', async (request, reply) => {
  const skill = SKILLS.find((s) => s.id === request.params.id)
  if (!skill) {
    return reply.code(404).send({ error: 'skill not found' })
  }

  const skillMd = `---
name: ${skill.name}
description: ${skill.description}
author: ${skill.author}
version: ${skill.version}
---

# ${skill.name}

${skill.description}

Author: ${skill.author}
Version: ${skill.version}
`

  const pass = new PassThrough()
  const gzip = createGzip()

  reply.header('content-type', 'application/gzip')
  reply.header('content-disposition', `attachment; filename="${skill.name}-${skill.version}.tar.gz"`)

  const pack = tarPack()
  const buf = Buffer.from(skillMd, 'utf8')
  pack.entry({ name: `${skill.name}/SKILL.md`, size: buf.length }, buf, (err) => {
    if (err) fastify.log.error(err)
    pack.finalize()
  })

  pack.pipe(gzip).pipe(pass)

  return reply.send(pass)
})

try {
  await fastify.listen({ port: 3100, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
