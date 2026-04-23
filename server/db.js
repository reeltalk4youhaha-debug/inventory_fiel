import { Pool } from 'pg'
import dotenv from 'dotenv'
import process from 'node:process'

dotenv.config()

export const dbSchema = process.env.DB_SCHEMA || 'inventory_hq'

const hasConnectionString = Boolean(process.env.DATABASE_URL)
const shouldUseSsl = process.env.DB_SSL === 'true' || (process.env.DB_SSL !== 'false' && hasConnectionString)
const connectionConfig = hasConnectionString
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventory_hq',
      port: Number(process.env.DB_PORT || 5432),
    }

export const pool = new Pool({
  ...connectionConfig,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  allowExitOnIdle: true,
})
