import { mockAdminApi, isMockMode } from './mock'

const BASE = '/api/v1'
const TOKEN_KEY = 'natcon-admin-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)
export { isMockMode, setMockMode, resetMockState } from './mock'

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

// Setiap panggilan dialihkan ke lapisan mock lokal saat mode demo aktif.
const mock = mockAdminApi

export const api = {
  login: (email, password) =>
    isMockMode() ? mock.login(email, password) : request('/auth/login', { method: 'POST', body: { email, password } }),
  overview: (opts) => (isMockMode() ? mock.overview() : request('/admin/overview', opts)),
  tenants: (opts) => (isMockMode() ? mock.tenants() : request('/admin/tenants', opts)),
  seminars: (opts) => (isMockMode() ? mock.seminars() : request('/admin/seminars', opts)),
  activity: (limit = 15, opts = {}) =>
    isMockMode() ? mock.activity(limit) : request(`/admin/activity?limit=${limit}`, opts),

  members: (opts) => (isMockMode() ? mock.members() : request('/admin/members', opts)),
  createMember: (body) =>
    isMockMode() ? mock.createMember(body) : request('/admin/members', { method: 'POST', body }),
  updateMember: (id, body) =>
    isMockMode() ? mock.updateMember(id, body) : request(`/admin/members/${id}`, { method: 'PUT', body }),
  deleteMember: (id) =>
    isMockMode() ? mock.deleteMember(id) : request(`/admin/members/${id}`, { method: 'DELETE' }),

  createTenant: (body) =>
    isMockMode() ? mock.createTenant(body) : request('/admin/tenants', { method: 'POST', body }),
  updateTenant: (id, body) =>
    isMockMode() ? mock.updateTenant(id, body) : request(`/admin/tenants/${id}`, { method: 'PUT', body }),
  deleteTenant: (id) =>
    isMockMode() ? mock.deleteTenant(id) : request(`/admin/tenants/${id}`, { method: 'DELETE' }),

  createSeminar: (body) =>
    isMockMode() ? mock.createSeminar(body) : request('/admin/seminars', { method: 'POST', body }),
  updateSeminar: (id, body) =>
    isMockMode() ? mock.updateSeminar(id, body) : request(`/admin/seminars/${id}`, { method: 'PUT', body }),
  deleteSeminar: (id) =>
    isMockMode() ? mock.deleteSeminar(id) : request(`/admin/seminars/${id}`, { method: 'DELETE' }),

  memberDetail: (id, opts) => (isMockMode() ? mock.memberDetail(id) : request(`/admin/members/${id}`, opts)),
  tenantDetail: (id, opts) => (isMockMode() ? mock.tenantDetail(id) : request(`/admin/tenants/${id}`, opts)),
  seminarDetail: (id, opts) => (isMockMode() ? mock.seminarDetail(id) : request(`/admin/seminars/${id}`, opts)),

  bulkMembers: (members) =>
    isMockMode() ? mock.bulkMembers(members) : request('/admin/members/bulk', { method: 'POST', body: { members } }),
  bulkTenants: (tenants) =>
    isMockMode() ? mock.bulkTenants(tenants) : request('/admin/tenants/bulk', { method: 'POST', body: { tenants } }),
  visitReport: () => (isMockMode() ? mock.visitReport() : request('/admin/report/visits')),
  registrationReport: () => (isMockMode() ? mock.registrationReport() : request('/admin/report/registrations')),
}
