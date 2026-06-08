import { createApp } from './app.js'
import { ensureBucket } from './storage.js'

const fastify = await createApp()

const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS, 10) || 10000

function shutdown(signal) {
  fastify.log.info(`Received ${signal}, shutting down gracefully`)
  const timer = setTimeout(() => {
    fastify.log.error('Shutdown timeout exceeded, forcing exit')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  timer.unref()
  fastify.close().then(() => {
    fastify.log.info('Server closed')
    process.exit(0)
  }).catch((err) => {
    fastify.log.error(err, 'Error during shutdown')
    process.exit(1)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

try {
  await ensureBucket()
  await fastify.listen({ port: 3100, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
