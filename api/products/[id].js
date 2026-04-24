import { handleVercelRequest, vercelApiConfig } from '../../server/lib/vercelHandler.js'

export const config = vercelApiConfig

export default async function handler(req, res) {
  const productId = String(req.query?.id || '').trim()
  await handleVercelRequest(req, res, `/products/${productId}`)
}
