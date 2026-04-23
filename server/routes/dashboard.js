import { Router } from 'express'
import { pool } from '../db.js'
import { normalizeStatus } from '../helpers.js'

const router = Router()

router.get('/summary', async (_req, res) => {
  const [products] = await pool.query('SELECT quantity, expiry_date FROM products')
  const [stockLogs] = await pool.query('SELECT id FROM stock_logs')

  const normalized = products.map((item) => normalizeStatus(item.quantity, item.expiry_date))

  const summary = {
    totalProducts: products.length,
    totalUnits: products.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    inStock: normalized.filter((item) => item === 'In Stock').length,
    lowStock: normalized.filter((item) => item === 'Low Stock').length,
    expiringSoon: normalized.filter((item) => item === 'Expiring soon').length,
    totalMovements: stockLogs.length,
  }

  res.json({ summary })
})

export default router
