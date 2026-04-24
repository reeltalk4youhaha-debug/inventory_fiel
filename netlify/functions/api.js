import { handleApiRequest } from '../../server/lib/apiHandler.js'

function json(statusCode, payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

async function parseBody(event) {
  if (!event.body) {
    return {}
  }

  try {
    return JSON.parse(event.body)
  } catch {
    return null
  }
}

export async function handler(event) {
  const result = await handleApiRequest({
    method: event.httpMethod,
    path: event.queryStringParameters?.path || event.path || '/',
    headers: event.headers || {},
    body: await parseBody(event),
    logger: console,
  })

  if (result.statusCode === 204) {
    return new Response(null, {
      status: 204,
      headers: result.headers,
    })
  }

  return json(result.statusCode, result.payload, result.headers)
}

export default handler
