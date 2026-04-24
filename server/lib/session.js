import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import process from 'node:process'

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7
const LOCAL_DEV_SECRET = 'inventory-fiel-local-session-secret'

function getSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET
  }

  if (process.env.NODE_ENV !== 'production') {
    return LOCAL_DEV_SECRET
  }

  throw new Error('SESSION_SECRET is not configured.')
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodePayload(encodedPayload) {
  return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
}

function createSignature(encodedPayload) {
  return createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url')
}

export function createSessionToken(user) {
  const encodedPayload = encodePayload({
    userId: Number(user.id),
    email: String(user.email || '').trim().toLowerCase(),
    exp: Date.now() + SESSION_DURATION_MS,
  })

  return `${encodedPayload}.${createSignature(encodedPayload)}`
}

export function verifySessionToken(token) {
  if (!token) {
    return null
  }

  const [encodedPayload, providedSignature, ...rest] = String(token).split('.')

  if (!encodedPayload || !providedSignature || rest.length > 0) {
    return null
  }

  const expectedSignature = createSignature(encodedPayload)
  const providedBuffer = Buffer.from(providedSignature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null
  }

  try {
    const payload = decodePayload(encodedPayload)

    if (!payload?.userId || !payload?.exp || Number(payload.exp) <= Date.now()) {
      return null
    }

    return {
      userId: Number(payload.userId),
      email: String(payload.email || '').trim().toLowerCase(),
      exp: Number(payload.exp),
    }
  } catch {
    return null
  }
}

export function extractBearerToken(headers = {}) {
  const authorization = headers.authorization || headers.Authorization || ''

  if (!authorization.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice(7).trim() || null
}
