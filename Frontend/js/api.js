const API_BASE =
  (typeof window !== 'undefined' && window.__APP_CONFIG__ && window.__APP_CONFIG__.API_BASE) ||
  'http://localhost:5000/api'

function apiUrl(path) {
  return `${API_BASE}${path}`
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem('authToken')
  const headers = { ...extra }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function authFetch(url, options = {}) {
  const opts = {
    ...options,
    credentials: 'include',
    headers: authHeaders(options.headers || {}),
  }
  const response = await fetch(url, opts)
  if (response.status === 401) {
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('authToken')
    localStorage.removeItem('userRole')
    if (window.location.pathname.includes('/pages/')) window.location.replace('../../index.html')
  }
  return response
}

async function apiJson(path, options = {}) {
  const response = await authFetch(apiUrl(path), options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false)
    throw new Error(data.message || `Request failed with HTTP ${response.status}`)
  return data
}

function escapeHTML(value) {
  return String(value ?? '').replace(
    /[&<>'"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]
  )
}
