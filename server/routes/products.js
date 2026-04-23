import { Router } from 'express'
import {
  createProductRecord,
  deleteProductRecord,
  listProducts,
  updateProductRecord,
} from '../lib/inventoryService.js'

const router = Router()

router.get('/', async (_req, res) => {
  const products = await listProducts()
  res.json({ products })
})

router.post('/', async (req, res) => {
  const product = await createProductRecord(req.body)
  res.status(201).json({ product })
})

router.put('/:id', async (req, res) => {
  const product = await updateProductRecord(req.params.id, req.body)

  if (!product) {
    return res.status(404).json({ message: 'Product not found' })
  }

  res.json({ product })
})

router.delete('/:id', async (req, res) => {
  const wasDeleted = await deleteProductRecord(req.params.id)

  if (!wasDeleted) {
    return res.status(404).json({ message: 'Product not found' })
  }

  res.json({ success: true })
})

export default router
