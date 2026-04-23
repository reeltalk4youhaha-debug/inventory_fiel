import { Router } from 'express'
import { authenticateAdminUser } from '../lib/inventoryService.js'
import { createSessionToken } from '../lib/session.js'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const user = await authenticateAdminUser(email, password)

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  res.json({
    user,
    token: createSessionToken(user),
  })
})

export default router
