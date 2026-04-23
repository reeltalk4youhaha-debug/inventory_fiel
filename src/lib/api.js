const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const SESSION_TOKEN_KEY = 'vapor-hq-session-token'

const jsonHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getSessionToken() {
  if (!hasLocalStorage()) {
    return ''
  }

  return window.localStorage.getItem(SESSION_TOKEN_KEY) || ''
}

export function persistSessionToken(token) {
  if (!hasLocalStorage()) {
    return
  }

  if (token) {
    window.localStorage.setItem(SESSION_TOKEN_KEY, String(token))
    return
  }

  window.localStorage.removeItem(SESSION_TOKEN_KEY)
}

export function clearSessionToken() {
  if (!hasLocalStorage()) {
    return
  }

  window.localStorage.removeItem(SESSION_TOKEN_KEY)
}

function buildHeaders(customHeaders = {}) {
  const token = getSessionToken()

  return {
    ...jsonHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...customHeaders,
  }
}

async function request(path, options = {}) {
  const { headers, ...restOptions } = options
  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: buildHeaders(headers),
      ...restOptions,
    })
  } catch {
    throw new Error('Cannot connect to the API. Check your backend or Netlify functions setup.')
  }

  if (response.status === 401) {
    clearSessionToken()
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message || 'Request failed')
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export const inventoryApi = {
  login: (payload) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getProfile: () => request('/api/profile'),
  updateProfile: (payload) =>
    request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateEmail: (payload) =>
    request('/api/profile/email', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updatePassword: (payload) =>
    request('/api/profile/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getProducts: () => request('/api/products'),
  createProduct: (payload) =>
    request('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProduct: (id, payload) =>
    request(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteProduct: (id) =>
    request(`/api/products/${id}`, {
      method: 'DELETE',
    }),
}
