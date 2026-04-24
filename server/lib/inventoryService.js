import { dbSchema, pool } from '../db.js'

function normalizeText(value) {
  return String(value ?? '').trim()
}

export function mapUser(row) {
  return {
    id: row.admin_id,
    name: row.full_name,
    role: row.role,
    workspace: row.workspace_name,
    email: row.email,
    memberSince: row.member_since,
  }
}

export function mapProduct(row) {
  return {
    id: row.product_id,
    name: row.product_name,
    flavor: row.flavor,
    sku: row.sku,
    description: row.description || '',
    items: Number(row.quantity || 0),
    updates: row.last_update || 'Recently added product',
    imageUrl: row.image_url || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function authenticateAdminUser(email, password) {
  const result = await pool.query(
    `SELECT admin_id, full_name, role, workspace_name, email, member_since
     FROM ${dbSchema}.admin_users
     WHERE email = $1
       AND is_active = TRUE
       AND password_hash = crypt($2, password_hash)
     LIMIT 1`,
    [normalizeText(email).toLowerCase(), String(password ?? '')],
  )

  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function getAdminUserById(adminId) {
  const result = await pool.query(
    `SELECT admin_id, full_name, role, workspace_name, email, member_since
     FROM ${dbSchema}.admin_users
     WHERE admin_id = $1
       AND is_active = TRUE
     LIMIT 1`,
    [Number(adminId)],
  )

  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function verifyAdminPassword(adminId, password) {
  const result = await pool.query(
    `SELECT admin_id
     FROM ${dbSchema}.admin_users
     WHERE admin_id = $1
       AND is_active = TRUE
       AND password_hash = crypt($2, password_hash)
     LIMIT 1`,
    [Number(adminId), String(password ?? '')],
  )

  return result.rows.length > 0
}

export async function updateAdminProfile(adminId, { name, role, workspace }) {
  const result = await pool.query(
    `UPDATE ${dbSchema}.admin_users
     SET full_name = COALESCE(NULLIF($1, ''), full_name),
         role = COALESCE(NULLIF($2, ''), role),
         workspace_name = COALESCE(NULLIF($3, ''), workspace_name),
         updated_at = CURRENT_TIMESTAMP
     WHERE admin_id = $4
       AND is_active = TRUE
     RETURNING admin_id, full_name, role, workspace_name, email, member_since`,
    [normalizeText(name), normalizeText(role), normalizeText(workspace), Number(adminId)],
  )

  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function updateAdminEmail(adminId, email) {
  const result = await pool.query(
    `UPDATE ${dbSchema}.admin_users
     SET email = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE admin_id = $2
       AND is_active = TRUE
     RETURNING admin_id, full_name, role, workspace_name, email, member_since`,
    [normalizeText(email).toLowerCase(), Number(adminId)],
  )

  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function updateAdminPassword(adminId, nextPassword) {
  const result = await pool.query(
    `UPDATE ${dbSchema}.admin_users
     SET password_hash = crypt($1, gen_salt('bf')),
         updated_at = CURRENT_TIMESTAMP
     WHERE admin_id = $2
       AND is_active = TRUE
     RETURNING admin_id`,
    [String(nextPassword ?? ''), Number(adminId)],
  )

  return result.rows.length > 0
}

export async function listProducts() {
  const result = await pool.query(
    `SELECT product_id, product_name, flavor, sku, quantity, description, last_update, image_url, created_at, updated_at
     FROM ${dbSchema}.products
     ORDER BY created_at DESC, product_id DESC`,
  )

  return result.rows.map(mapProduct)
}

export async function createProductRecord({ name, flavor, sku, items, description, updates, imageUrl }) {
  const result = await pool.query(
    `INSERT INTO ${dbSchema}.products
      (product_name, flavor, sku, quantity, description, last_update, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING product_id, product_name, flavor, sku, quantity, description, last_update, image_url, created_at, updated_at`,
    [
      normalizeText(name),
      normalizeText(flavor),
      normalizeText(sku),
      Number(items || 0),
      normalizeText(description),
      normalizeText(updates) || 'Recently added product',
      normalizeText(imageUrl),
    ],
  )

  return mapProduct(result.rows[0])
}

export async function updateProductRecord(productId, { name, flavor, sku, items, description, updates, imageUrl }) {
  const result = await pool.query(
    `UPDATE ${dbSchema}.products
     SET product_name = $1,
         flavor = $2,
         sku = $3,
         quantity = $4,
         description = $5,
         last_update = $6,
         image_url = $7,
         updated_at = CURRENT_TIMESTAMP
     WHERE product_id = $8
     RETURNING product_id, product_name, flavor, sku, quantity, description, last_update, image_url, created_at, updated_at`,
    [
      normalizeText(name),
      normalizeText(flavor),
      normalizeText(sku),
      Number(items || 0),
      normalizeText(description),
      normalizeText(updates) || 'Product updated',
      normalizeText(imageUrl),
      Number(productId),
    ],
  )

  return result.rows[0] ? mapProduct(result.rows[0]) : null
}

export async function deleteProductRecord(productId) {
  const result = await pool.query(
    `DELETE FROM ${dbSchema}.products
     WHERE product_id = $1
     RETURNING product_id`,
    [Number(productId)],
  )

  return result.rows.length > 0
}
