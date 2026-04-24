import { handleVercelRequest, vercelApiConfig } from '../server/lib/vercelHandler.js'

export const config = vercelApiConfig

export default async function handler(req, res) {
  await handleVercelRequest(req, res, '/health')
}
