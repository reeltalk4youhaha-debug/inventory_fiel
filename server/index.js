import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import process from 'node:process'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import profileRoutes from './routes/profile.js'
import { requireAuth } from './middleware/auth.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 4000)

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRoutes)
app.use('/api/products', requireAuth, productRoutes)
app.use('/api/profile', requireAuth, profileRoutes)

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ message: 'Internal server error' })
})

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`)
})
