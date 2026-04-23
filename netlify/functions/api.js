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
} from '../../server/lib/inventoryService.js'
import { createSessionToken, extractBearerToken, verifySessionToken } from '../../server/lib/session.js'

function json(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function getRoutePath(event) {
  // Netlify redirect passes path as query param from netlify.toml
  let rawPath = event.queryStringParameters?.path || ''
  // Fallback to event.path if available
  if (!rawPath) {
    rawPath = event.path || ''
  }
  // Remove leading/trailing slashes and normalize
  rawPath = String(rawPath).trim().replace(/^\/+/, '').replace(/\/+$/, '')
  return `/${rawPath}`
}

async function parseBody(event) {
  if (!event.body) {
    return {}
  }

  try {
    return JSON.parse(event.body)
  } catch {
    return null
  }
}

async function requireUser(event) {
  const token = extractBearerToken(event.headers)
  const session = verifySessionToken(token)

  if (!session) {
    return null
  }

  return getAdminUserById(session.userId)
}

export async function handler(event) {
  const method = String(event.httpMethod || 'GET').toUpperCase()
  const routePath = getRoutePath(event)
  const productMatch = routePath.match(/^\/products\/(\d+)$/)

  try {
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          Allow: 'GET,POST,PUT,DELETE,OPTIONS',
        },
      })
    }

    if (routePath === '/health') {
      if (method !== 'GET') {
        return json(405, { message: 'Method not allowed' })
      }

      return json(200, { ok: true })
    }

    if (routePath === '/auth/login') {
      if (method !== 'POST') {
        return json(405, { message: 'Method not allowed' })
      }

      const body = await parseBody(event)

      if (!body) {
        return json(400, { message: 'Invalid JSON payload' })
      }

      const user = await authenticateAdminUser(body.email, body.password)

      if (!user) {
        return json(401, { message: 'Invalid email or password' })
      }

      return json(200, {
        user,
        token: createSessionToken(user),
      })
    }

    const currentUser = await requireUser(event)

    if (!currentUser) {
      return json(401, { message: 'Session expired. Please sign in again.' })
    }

    if (routePath === '/profile') {
      if (method === 'GET') {
        return json(200, { user: currentUser })
      }

      if (method === 'PUT') {
        const body = await parseBody(event)

        if (!body) {
          return json(400, { message: 'Invalid JSON payload' })
        }

        const user = await updateAdminProfile(currentUser.id, body)

        if (!user) {
          return json(404, { message: 'Admin account not found' })
        }

        return json(200, { user })
      }

      return json(405, { message: 'Method not allowed' })
    }

    if (routePath === '/profile/email') {
      if (method !== 'PUT') {
        return json(405, { message: 'Method not allowed' })
      }

      const body = await parseBody(event)

      if (!body) {
        return json(400, { message: 'Invalid JSON payload' })
      }

      const isValidPassword = await verifyAdminPassword(currentUser.id, body.currentPassword)

      if (!isValidPassword) {
        return json(401, { message: 'Current password is incorrect' })
      }

      const user = await updateAdminEmail(currentUser.id, body.email)
      return json(200, { user })
    }

    if (routePath === '/profile/password') {
      if (method !== 'PUT') {
        return json(405, { message: 'Method not allowed' })
      }

      const body = await parseBody(event)

      if (!body) {
        return json(400, { message: 'Invalid JSON payload' })
      }

      const isValidPassword = await verifyAdminPassword(currentUser.id, body.currentPassword)

      if (!isValidPassword) {
        return json(401, { message: 'Current password is incorrect' })
      }

      await updateAdminPassword(currentUser.id, body.nextPassword)
      return json(200, { success: true })
    }

    if (routePath === '/products') {
      if (method === 'GET') {
        const products = await listProducts()
        return json(200, { products })
      }

      if (method === 'POST') {
        const body = await parseBody(event)

        if (!body) {
          return json(400, { message: 'Invalid JSON payload' })
        }

        const product = await createProductRecord(body)
        return json(201, { product })
      }

      return json(405, { message: 'Method not allowed' })
    }

    if (productMatch) {
      const productId = Number(productMatch[1])

      if (method === 'PUT') {
        const body = await parseBody(event)

        if (!body) {
          return json(400, { message: 'Invalid JSON payload' })
        }

        const product = await updateProductRecord(productId, body)

        if (!product) {
          return json(404, { message: 'Product not found' })
        }

        return json(200, { product })
      }

      if (method === 'DELETE') {
        const wasDeleted = await deleteProductRecord(productId)

        if (!wasDeleted) {
          return json(404, { message: 'Product not found' })
        }

        return json(200, { success: true })
      }

      return json(405, { message: 'Method not allowed' })
    }

    return json(404, { message: 'Route not found' })
  } catch (error) {
    console.error(error)
    return json(500, { message: 'Internal server error' })
  }
}

export default handler
