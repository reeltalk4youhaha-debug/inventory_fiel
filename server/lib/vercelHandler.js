import { handleApiRequest } from './apiHandler.js'

export const vercelApiConfig = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

function parseBody(body) {
  if (body === undefined || body === null || body === '') {
    return {}
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return null
    }
  }

  return body
}

export async function handleVercelRequest(req, res, path) {
  const result = await handleApiRequest({
    method: req.method,
    path,
    headers: req.headers || {},
    body: parseBody(req.body),
    logger: console,
  })

  if (result.headers) {
    Object.entries(result.headers).forEach(([key, value]) => {
      res.setHeader(key, value)
    })
  }

  if (result.statusCode === 204) {
    res.status(204).end()
    return
  }

  res.setHeader('Cache-Control', 'no-store')
  res.status(result.statusCode).json(result.payload)
}
