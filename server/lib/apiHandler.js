import {
  authenticateAdminUser,
  createProductRecord,
  deleteProductRecord,
  getAdminUserById,
  listProducts,
  updateAdminEmail,
  updateAdminPassword,
  updateAdminProfile,
  updateProductRecord,
  verifyAdminPassword,
} from './inventoryService.js'
import { getApiErrorPayload } from './apiErrors.js'
import { getDatabaseHealth } from './health.js'
import { createSessionToken, extractBearerToken, verifySessionToken } from './session.js'

function normalizeRoutePath(path) {
  let routePath = String(path || '/').trim()

  if (!routePath.startsWith('/')) {
    routePath = `/${routePath}`
  }

  return routePath.replace(/\/$/, '') || '/'
}

async function requireUser(headers = {}) {
  const token = extractBearerToken(headers)
  const session = verifySessionToken(token)

  if (!session) {
    return null
  }

  return getAdminUserById(session.userId)
}

export async function handleApiRequest({
  method = 'GET',
  path = '/',
  headers = {},
  body = {},
  logger = console,
} = {}) {
  const requestMethod = String(method || 'GET').toUpperCase()
  const routePath = normalizeRoutePath(path)
  const productMatch = routePath.match(/^\/products\/(\d+)$/)

  logger.log?.('API request:', requestMethod, routePath)

  try {
    if (routePath === '/' || routePath === '/health' || routePath.includes('health')) {
      if (requestMethod === 'GET') {
        const db = await getDatabaseHealth()
        return { statusCode: 200, payload: { ok: true, db } }
      }

      return { statusCode: 405, payload: { message: 'Method not allowed' } }
    }

    if (requestMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        payload: null,
        headers: {
          Allow: 'GET,POST,PUT,DELETE,OPTIONS',
        },
      }
    }

    if (routePath === '/auth/login') {
      if (requestMethod !== 'POST') {
        return { statusCode: 405, payload: { message: 'Method not allowed' } }
      }

      if (body === null) {
        return { statusCode: 400, payload: { message: 'Invalid JSON payload' } }
      }

      const user = await authenticateAdminUser(body.email, body.password)

      if (!user) {
        return { statusCode: 401, payload: { message: 'Invalid email or password' } }
      }

      return {
        statusCode: 200,
        payload: {
          user,
          token: createSessionToken(user),
        },
      }
    }

    const currentUser = await requireUser(headers)

    if (!currentUser) {
      return { statusCode: 401, payload: { message: 'Session expired. Please sign in again.' } }
    }

    if (routePath === '/profile') {
      if (requestMethod === 'GET') {
        return { statusCode: 200, payload: { user: currentUser } }
      }

      if (requestMethod === 'PUT') {
        if (body === null) {
          return { statusCode: 400, payload: { message: 'Invalid JSON payload' } }
        }

        const user = await updateAdminProfile(currentUser.id, body)

        if (!user) {
          return { statusCode: 404, payload: { message: 'Admin account not found' } }
        }

        return { statusCode: 200, payload: { user } }
      }

      return { statusCode: 405, payload: { message: 'Method not allowed' } }
    }

    if (routePath === '/profile/email') {
      if (requestMethod !== 'PUT') {
        return { statusCode: 405, payload: { message: 'Method not allowed' } }
      }

      if (body === null) {
        return { statusCode: 400, payload: { message: 'Invalid JSON payload' } }
      }

      const isValidPassword = await verifyAdminPassword(currentUser.id, body.currentPassword)

      if (!isValidPassword) {
        return { statusCode: 401, payload: { message: 'Current password is incorrect' } }
      }

      const user = await updateAdminEmail(currentUser.id, body.email)
      return { statusCode: 200, payload: { user } }
    }

    if (routePath === '/profile/password') {
      if (requestMethod !== 'PUT') {
        return { statusCode: 405, payload: { message: 'Method not allowed' } }
      }

      if (body === null) {
        return { statusCode: 400, payload: { message: 'Invalid JSON payload' } }
      }

      const isValidPassword = await verifyAdminPassword(currentUser.id, body.currentPassword)

      if (!isValidPassword) {
        return { statusCode: 401, payload: { message: 'Current password is incorrect' } }
      }

      await updateAdminPassword(currentUser.id, body.nextPassword)
      return { statusCode: 200, payload: { success: true } }
    }

    if (routePath === '/products') {
      if (requestMethod === 'GET') {
        const products = await listProducts()
        return { statusCode: 200, payload: { products } }
      }

      if (requestMethod === 'POST') {
        if (body === null) {
          return { statusCode: 400, payload: { message: 'Invalid JSON payload' } }
        }

        const product = await createProductRecord(body)
        return { statusCode: 201, payload: { product } }
      }

      return { statusCode: 405, payload: { message: 'Method not allowed' } }
    }

    if (productMatch) {
      const productId = Number(productMatch[1])

      if (requestMethod === 'PUT') {
        if (body === null) {
          return { statusCode: 400, payload: { message: 'Invalid JSON payload' } }
        }

        const product = await updateProductRecord(productId, body)

        if (!product) {
          return { statusCode: 404, payload: { message: 'Product not found' } }
        }

        return { statusCode: 200, payload: { product } }
      }

      if (requestMethod === 'DELETE') {
        const wasDeleted = await deleteProductRecord(productId)

        if (!wasDeleted) {
          return { statusCode: 404, payload: { message: 'Product not found' } }
        }

        return { statusCode: 200, payload: { success: true } }
      }

      return { statusCode: 405, payload: { message: 'Method not allowed' } }
    }

    return { statusCode: 404, payload: { message: 'Route not found' } }
  } catch (error) {
    logger.error?.(error)
    const { statusCode, message } = getApiErrorPayload(error)
    return { statusCode, payload: { message } }
  }
}
