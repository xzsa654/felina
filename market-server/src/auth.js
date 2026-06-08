import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID, createHash } from 'node:crypto'

const SALT_ROUNDS = 10

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  return secret
}

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signToken({ sub, email }) {
  const expiresIn = process.env.ACCESS_TOKEN_EXPIRY || '15m'
  return jwt.sign({ sub, email }, getSecret(), { expiresIn })
}

export function generateRefreshToken() {
  return randomUUID()
}

export function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret())
}

export function requireAuth(request, reply, done) {
  const header = request.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'authentication required' })
    return
  }
  const token = header.slice(7)
  try {
    const payload = verifyToken(token)
    request.user = { sub: payload.sub, email: payload.email }
  } catch {
    reply.code(401).send({ error: 'invalid or expired token' })
    return
  }
  done()
}
