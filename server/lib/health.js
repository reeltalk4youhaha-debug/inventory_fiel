import { dbSchema, pool } from '../db.js'

export async function getDatabaseHealth() {
  const connectionResult = await pool.query(
    'SELECT current_database() AS database_name, NOW() AS server_time',
  )
  const tableResult = await pool.query(
    'SELECT to_regclass($1) AS admin_users_table, to_regclass($2) AS products_table',
    [`${dbSchema}.admin_users`, `${dbSchema}.products`],
  )

  const adminUsersTable = Boolean(tableResult.rows[0]?.admin_users_table)
  const productsTable = Boolean(tableResult.rows[0]?.products_table)

  let adminUsersCount = null
  let productsCount = null

  if (adminUsersTable) {
    const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM ${dbSchema}.admin_users`)
    adminUsersCount = Number(countResult.rows[0]?.count ?? 0)
  }

  if (productsTable) {
    const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM ${dbSchema}.products`)
    productsCount = Number(countResult.rows[0]?.count ?? 0)
  }

  return {
    connected: true,
    schema: dbSchema,
    database: connectionResult.rows[0]?.database_name || '',
    serverTime: connectionResult.rows[0]?.server_time || null,
    tables: {
      adminUsers: adminUsersTable,
      products: productsTable,
    },
    counts: {
      adminUsers: adminUsersCount,
      products: productsCount,
    },
  }
}
