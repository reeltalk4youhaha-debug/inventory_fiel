import { Router } from 'express'
import {
  getAdminUserById,
  updateAdminEmail,
  updateAdminPassword,
  updateAdminProfile,
  verifyAdminPassword,
} from '../lib/inventoryService.js'

const router = Router()

router.get('/', async (req, res) => {
  res.json({ user: req.auth.user })
})

router.put('/', async (req, res) => {
  const user = await updateAdminProfile(req.auth.user.id, req.body)

  if (!user) {
    return res.status(404).json({ message: 'Admin account not found' })
  }

  res.json({ user })
})

router.put('/email', async (req, res) => {
  const currentUser = await getAdminUserById(req.auth.user.id)

  if (!currentUser) {
    return res.status(404).json({ message: 'Admin account not found' })
  }

  const { email, currentPassword } = req.body
  const isValidPassword = await verifyAdminPassword(currentUser.id, currentPassword)

  if (!isValidPassword) {
    return res.status(401).json({ message: 'Current password is incorrect' })
  }

  const user = await updateAdminEmail(currentUser.id, email)
  res.json({ user })
})

router.put('/password', async (req, res) => {
  const currentUser = await getAdminUserById(req.auth.user.id)

  if (!currentUser) {
    return res.status(404).json({ message: 'Admin account not found' })
  }

  const { currentPassword, nextPassword } = req.body
  const isValidPassword = await verifyAdminPassword(currentUser.id, currentPassword)

  if (!isValidPassword) {
    return res.status(401).json({ message: 'Current password is incorrect' })
  }

  await updateAdminPassword(currentUser.id, nextPassword)
  res.json({ success: true })
})

export default router
