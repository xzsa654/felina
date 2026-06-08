import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

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
  return jwt.sign({ sub, email }, getSecret(), { expiresIn: '7d' })
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
