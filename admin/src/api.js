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

// Friendly fallbacks when the server sends no message (proxy errors,
// rate limits, downtime).
const FRIENDLY_STATUS = {
  429: 'Too many attempts — wait a moment and try again.',
  500: 'The server is having trouble. Try again shortly, or turn on Demo (Mock) mode.',
  502: 'The server cannot be reached. Try again shortly.',
  503: 'The server is busy. Try again shortly.',
  504: 'The server took too long to respond. Try again shortly.',
}

async function request(path, { method = 'GET', body, onUnauthorized } = {}) {
  const token = getToken()
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server — check your connection, or turn on Demo (Mock) mode.')
  }
  if (res.status === 401 && path !== '/auth/login') {
    clearToken()
    onUnauthorized?.()
    throw new ApiError(401, 'Your session has expired — please log in again.')
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    /* empty/non-JSON body */
  }
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error || FRIENDLY_STATUS[res.status] || `Something went wrong (code ${res.status}). Please try again.`
    )
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

  // params: { q, page, limit, onUnauthorized } — respons { members, total, page, limit }
  members: (params = {}) => {
    const { q = '', page = 1, limit = 50, ...opts } = params
    if (isMockMode()) return mock.members({ q, page, limit })
    const qs = new URLSearchParams({ q, page, limit }).toString()
    return request(`/admin/members?${qs}`, opts)
  },
  seminarCheckin: (id, memberCode) =>
    isMockMode()
      ? mock.seminarCheckin(id, memberCode)
      : request(`/admin/seminars/${id}/checkin`, { method: 'POST', body: { member_code: memberCode } }),
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

  // Chunked so huge imports (bcrypt per row server-side) never outlast the
  // 30 s request timeout; row numbers in errors are re-offset per chunk.
  bulkMembers: async (members) => {
    const CHUNK = 200
    if (isMockMode()) return mock.bulkMembers(members)
    const total = { created: 0, updated: 0, failed: 0, errors: [] }
    for (let start = 0; start < members.length; start += CHUNK) {
      const res = await request('/admin/members/bulk', {
        method: 'POST',
        body: { members: members.slice(start, start + CHUNK) },
      })
      total.created += res.created
      total.updated += res.updated || 0
      total.failed += res.failed
      total.errors.push(...(res.errors || []).map((e) => ({ ...e, row: e.row + start })))
    }
    return total
  },
  bulkTenants: async (tenants) => {
    const CHUNK = 200
    if (isMockMode()) return mock.bulkTenants(tenants)
    const total = { created: 0, updated: 0, failed: 0, errors: [] }
    for (let start = 0; start < tenants.length; start += CHUNK) {
      const res = await request('/admin/tenants/bulk', {
        method: 'POST',
        body: { tenants: tenants.slice(start, start + CHUNK) },
      })
      total.created += res.created
      total.updated += res.updated || 0
      total.failed += res.failed
      total.errors.push(...(res.errors || []).map((e) => ({ ...e, row: e.row + start })))
    }
    return total
  },
  // Multipart image upload — returns { url } (served from /uploads/…).
  uploadImage: async (file) => {
    if (isMockMode()) return mock.uploadImage(file)
    const form = new FormData()
    form.append('file', file)
    let res
    try {
      res = await fetch(BASE + '/admin/uploads', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      })
    } catch {
      throw new ApiError(0, 'Cannot reach the server — check your connection, or turn on Demo (Mock) mode.')
    }
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new ApiError(res.status, data?.error || FRIENDLY_STATUS[res.status] || `Upload failed (code ${res.status}).`)
    }
    return data
  },
  chapters: (opts) => (isMockMode() ? mock.chapters() : request('/admin/chapters', opts)),
  createChapter: (name) =>
    isMockMode() ? mock.createChapter(name) : request('/admin/chapters', { method: 'POST', body: { name } }),
  renameChapter: (id, name) =>
    isMockMode() ? mock.renameChapter(id, name) : request(`/admin/chapters/${id}`, { method: 'PUT', body: { name } }),
  deleteChapter: (id) =>
    isMockMode() ? mock.deleteChapter(id) : request(`/admin/chapters/${id}`, { method: 'DELETE' }),
  visitReport: () => (isMockMode() ? mock.visitReport() : request('/admin/report/visits')),
  registrationReport: () => (isMockMode() ? mock.registrationReport() : request('/admin/report/registrations')),
}
