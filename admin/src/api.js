const BASE = '/api/v1'
const TOKEN_KEY = 'natcon-admin-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body, onUnauthorized } = {}) {
  const token = getToken()
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401 && path !== '/auth/login') {
    clearToken()
    onUnauthorized?.()
    throw new ApiError(401, 'Sesi berakhir, silakan login kembali')
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Request gagal (${res.status})`)
  }
  return data
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  overview: (opts) => request('/admin/overview', opts),
  tenants: (opts) => request('/admin/tenants', opts),
  seminars: (opts) => request('/admin/seminars', opts),
  activity: (limit = 15, opts = {}) => request(`/admin/activity?limit=${limit}`, opts),

  members: (opts) => request('/admin/members', opts),
  createMember: (body) => request('/admin/members', { method: 'POST', body }),
  updateMember: (id, body) => request(`/admin/members/${id}`, { method: 'PUT', body }),
  deleteMember: (id) => request(`/admin/members/${id}`, { method: 'DELETE' }),

  createTenant: (body) => request('/admin/tenants', { method: 'POST', body }),
  updateTenant: (id, body) => request(`/admin/tenants/${id}`, { method: 'PUT', body }),
  deleteTenant: (id) => request(`/admin/tenants/${id}`, { method: 'DELETE' }),

  createSeminar: (body) => request('/admin/seminars', { method: 'POST', body }),
  updateSeminar: (id, body) => request(`/admin/seminars/${id}`, { method: 'PUT', body }),
  deleteSeminar: (id) => request(`/admin/seminars/${id}`, { method: 'DELETE' }),
}
