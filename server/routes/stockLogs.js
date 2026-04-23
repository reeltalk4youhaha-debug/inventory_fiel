import { Router } from 'express'
import { pool } from '../db.js'
import { normalizeStatus, stockDelta } from '../helpers.js'

const router = Router()

async function recalculateProduct(connection, productId, deltaChange) {
  const [rows] = await connection.query('SELECT quantity, expiry_date FROM products WHERE id = ?', [productId])
  if (!rows.length) {
    throw new Error('Product not found')
  }

  const nextQuantity = Number(rows[0].quantity) + deltaChange
  const nextStatus = normalizeStatus(nextQuantity, rows[0].expiry_date)

  await connection.query('UPDATE products SET quantity = ?, status = ? WHERE id = ?', [nextQuantity, nextStatus, productId])
}

router.get('/', async (_req, res) => {
  const [stockLogs] = await pool.query(
    `SELECT sl.*, p.product_name
     FROM stock_logs sl
     JOIN products p ON p.id = sl.product_id
     ORDER BY sl.logged_at DESC`,
  )

  res.json({ stockLogs })
})

router.post('/', async (req, res) => {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const { product_id, action_type, quantity_change, notes, logged_at } = req.body
    const delta = stockDelta(action_type, quantity_change)

    const [result] = await connection.query(
      `INSERT INTO stock_logs (product_id, action_type, quantity_change, notes, logged_at)
       VALUES (?, ?, ?, ?, ?)`,
      [product_id, action_type, quantity_change, notes || '', logged_at],
    )

    await recalculateProduct(connection, product_id, delta)
    await connection.commit()

    const [rows] = await pool.query(
      `SELECT sl.*, p.product_name
       FROM stock_logs sl
       JOIN products p ON p.id = sl.product_id
       WHERE sl.id = ?`,
      [result.insertId],
    )

    res.status(201).json({ stockLog: rows[0] })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

router.put('/:id', async (req, res) => {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const { product_id, action_type, quantity_change, notes, logged_at } = req.body

    const [existingRows] = await connection.query('SELECT * FROM stock_logs WHERE id = ?', [req.params.id])
    if (!existingRows.length) {
      throw new Error('Stock log not found')
    }

    const existing = existingRows[0]
    const oldDelta = stockDelta(existing.action_type, existing.quantity_change)
    const newDelta = stockDelta(action_type, quantity_change)

    await connection.query(
      `UPDATE stock_logs
       SET product_id = ?, action_type = ?, quantity_change = ?, notes = ?, logged_at = ?
       WHERE id = ?`,
      [product_id, action_type, quantity_change, notes || '', logged_at, req.params.id],
    )

    await recalculateProduct(connection, existing.product_id, -oldDelta)
    await recalculateProduct(connection, product_id, newDelta)
    await connection.commit()

    const [rows] = await pool.query(
      `SELECT sl.*, p.product_name
       FROM stock_logs sl
       JOIN products p ON p.id = sl.product_id
       WHERE sl.id = ?`,
      [req.params.id],
    )

    res.json({ stockLog: rows[0] })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

router.delete('/:id', async (req, res) => {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const [existingRows] = await connection.query('SELECT * FROM stock_logs WHERE id = ?', [req.params.id])
    if (!existingRows.length) {
      throw new Error('Stock log not found')
    }

    const existing = existingRows[0]
    const reverseDelta = -stockDelta(existing.action_type, existing.quantity_change)

    await connection.query('DELETE FROM stock_logs WHERE id = ?', [req.params.id])
    await recalculateProduct(connection, existing.product_id, reverseDelta)
    await connection.commit()

    res.json({ success: true })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ message: error.message })
  } finally {
    connection.release()
  }
})

export default router
