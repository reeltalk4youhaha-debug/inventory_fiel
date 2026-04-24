import { handleApiRequest } from '../server/lib/apiHandler.js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

function getRequestPath(pathParam) {
  if (Array.isArray(pathParam) && pathParam.length) {
    return `/${pathParam.join('/')}`
  }

  if (typeof pathParam === 'string' && pathParam.trim()) {
    return `/${pathParam.trim()}`
  }

  return '/'
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

export default async function handler(req, res) {
  const result = await handleApiRequest({
    method: req.method,
    path: getRequestPath(req.query?.path),
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
