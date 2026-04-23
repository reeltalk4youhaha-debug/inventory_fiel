import { getAdminUserById } from '../lib/inventoryService.js'
import { extractBearerToken, verifySessionToken } from '../lib/session.js'

export async function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req.headers)
    const session = verifySessionToken(token)

    if (!session) {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' })
    }

    const user = await getAdminUserById(session.userId)

    if (!user) {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' })
    }

    req.auth = { session, user }
    next()
  } catch (error) {
    next(error)
  }
}
