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
  const path = event.queryStringParameters?.path || ''
  
  // SPECIAL: Health endpoint - doesn't need any imports
  if (path === 'health' || path === '/health' || path === '') {
    return new Response(JSON.stringify({ ok: true, time: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Debug: log everything
  console.log('=== INCOMING REQUEST ===')
  console.log('Method:', method)
  console.log('Path:', event.path)
  console.log('RawPath:', event.rawPath)
  console.log('QueryStringParameters:', event.queryStringParameters)
  
  // Get the route path
  let routePath = event.queryStringParameters?.path || event.path || ''
  routePath = String(routePath).trim()
  if (!routePath.startsWith('/')) routePath = '/' + routePath
  routePath = routePath.replace(/\/$/, '') || '/'
  
  console.log('Final routePath:', routePath)
  
  const productMatch = routePath.match(/^\/products\/(\d+)$/)

  try {
    // HEALTH CHECK - MUST COME FIRST, NO AUTH REQUIRED
    if (routePath === '/' || routePath === '/health' || routePath.includes('health')) {
      console.log('✓✓✓ HEALTH ENDPOINT MATCHED ✓✓✓')
      if (method === 'GET') {
        return json(200, { ok: true, timestamp: new Date().toISOString() })
      }
      return json(405, { message: 'Method not allowed' })
    }

    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          Allow: 'GET,POST,PUT,DELETE,OPTIONS',
        },
      })
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

    // ALL OTHER ROUTES REQUIRE AUTHENTICATION
    console.log('Checking authentication for route:', routePath)
    const currentUser = await requireUser(event)

    if (!currentUser) {
      console.log('❌ Authentication failed')
      return json(401, { message: 'Session expired. Please sign in again.' })
    }

    console.log('✓ User authenticated:', currentUser.email)

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
