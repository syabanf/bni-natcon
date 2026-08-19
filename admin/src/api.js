import { mockAdminApi, isMockMode } from './mock'
import { shrinkForUpload } from './image'

// Where the Go API lives. Empty (the default) means "same origin", which is
// what the Vite dev proxy and the nginx image both provide. Static hosts that
// only serve the built SPA (Vercel, Netlify, S3) have no /api to serve, so
// point VITE_API_URL at the deployed API instead — e.g.
// VITE_API_URL=https://api.natcon.example.com
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const BASE = `${API_ORIGIN}/api/v1`
const TOKEN_KEY = 'natcon-admin-token'

// Uploaded images (seminar covers) are served by the API; everything else —
// speaker photos, brand art — ships with the static app itself.
export function assetUrl(path) {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/.test(path)) return path
  if (!path.startsWith('/uploads/')) return path
  return API_ORIGIN + path
}

// Matches maxUploadBytes in the API (and client_max_body_size in nginx).
export const MAX_UPLOAD_BYTES = 5 << 20

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)
export { isMockMode, setMockMode, resetMockState } from './mock'
export { shrinkForUpload } from './image'

export class ApiError extends Error {
  // `body` carries the server's whole reply. Some refusals are not just a
  // message — a second goodiebag scan comes back with who collected it and
  // when, and the door crew needs to see that, not "conflict".
  constructor(status, message, body = null) {
    super(message)
    this.status = status
    this.body = body
  }
}

// Friendly fallbacks when the server sends no message (proxy errors,
// rate limits, downtime).
const FRIENDLY_STATUS = {
  404: 'The API is not reachable at this address. If this is a hosted build, VITE_API_URL is missing or wrong.',
  413: 'That was too big to send — try a smaller file or fewer rows at a time.',
  415: 'That file type is not supported here.',
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
      data?.error || FRIENDLY_STATUS[res.status] || `Something went wrong (code ${res.status}). Please try again.`,
      data,
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
  // Every attendee, page by page. The Lucky Draw and the pin report need the
  // whole field: a single capped page would silently leave people out of the
  // draw once the event outgrows one page.
  allMembers: async (opts = {}) => {
    const PAGE = 500
    const first = await api.members({ ...opts, page: 1, limit: PAGE })
    const out = [...(first.members || [])]
    const total = first.total ?? out.length
    for (let page = 2; out.length < total; page++) {
      const next = await api.members({ ...opts, page, limit: PAGE })
      if (!next.members?.length) break
      out.push(...next.members)
    }
    return out
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
  // Quota only — a narrow call so re-sizing a room from the class list
  // cannot blank the description, cover or speaker list the way a full
  // update built from a list row would.
  setSeminarQuota: (id, quota) =>
    isMockMode()
      ? mock.setSeminarQuota(id, quota)
      : request(`/admin/seminars/${id}/quota`, { method: 'PATCH', body: { quota } }),
  deleteSeminar: (id) =>
    isMockMode() ? mock.deleteSeminar(id) : request(`/admin/seminars/${id}`, { method: 'DELETE' }),

  registerSeminarMember: (id, member) =>
    isMockMode()
      ? mock.registerSeminarMember(id, member)
      : request(`/admin/seminars/${id}/registrations`, { method: 'POST', body: { member } }),
  unregisterSeminarMember: (id, memberCode) =>
    isMockMode()
      ? mock.unregisterSeminarMember(id, memberCode)
      : request(`/admin/seminars/${id}/registrations/${encodeURIComponent(memberCode)}`, { method: 'DELETE' }),
  bulkRegistrations: async (registrations) => {
    const CHUNK = 200
    if (isMockMode()) return mock.bulkRegistrations(registrations)
    const total = { created: 0, updated: 0, failed: 0, errors: [] }
    for (let start = 0; start < registrations.length; start += CHUNK) {
      const res = await request('/admin/seminars/registrations/bulk', {
        method: 'POST',
        body: { registrations: registrations.slice(start, start + CHUNK) },
      })
      total.created += res.created
      total.updated += res.updated || 0
      total.failed += res.failed
      total.errors.push(...(res.errors || []).map((e) => ({ ...e, row: e.row + start })))
    }
    return total
  },

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
  uploadImage: async (original) => {
    if (isMockMode()) return mock.uploadImage(original)
    // Scale the picture down before it goes anywhere. The upload is the slow
    // part — the server answers in ~10 ms — and a cover is never displayed
    // anywhere near the size a phone camera produces.
    const startedAt = Date.now()
    const file = await shrinkForUpload(original)
    const shrankAt = Date.now()
    // Only then complain about size: a 6 MB photo usually comes out well
    // under the limit, so refusing it up front would be wrong.
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(413,
        `That image is ${(file.size / (1 << 20)).toFixed(1)} MB — the limit is 5 MB. ` +
        'Resize it, or export it at a smaller quality.')
    }
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
    // One line per upload, so a slow upload can be explained instead of
    // guessed at: it says whether the time went into the picture or the wire.
    const kb = (n) => `${Math.round(n / 1024)} KB`
    console.info(
      `[upload] ${kb(original.size)} → ${kb(file.size)} in ${shrankAt - startedAt} ms, ` +
      `sent in ${Date.now() - shrankAt} ms`)

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      // The API's own message is the most specific thing available — it
      // knows the file was HEIC, or exactly how far over the limit it was.
      // A proxy that killed the body sends HTML or nothing, and that is the
      // only case worth guessing about.
      const friendly = data?.error
        || ([413, 502, 504].includes(res.status)
          ? 'The image did not get through — it is probably too large. The limit is 5 MB.'
          : FRIENDLY_STATUS[res.status] || `Upload failed (code ${res.status}).`)
      throw new ApiError(res.status, friendly)
    }
    return data
  },
  // The desk that hands over pins and goodiebags, by scan (MoM 19 Aug 2026).
  redeem: (memberCode, item) =>
    request('/admin/redeem', { method: 'POST', body: { member_code: memberCode, item } }),
  redeemCounts: (opts) => request('/admin/redeem/counts', opts),
  // Event schedule — one-hour blocks (MoM 19 Aug 2026).
  rundown: (opts) => request('/admin/rundown', opts),
  createRundown: (body) => request('/admin/rundown', { method: 'POST', body }),
  updateRundown: (id, body) => request(`/admin/rundown/${id}`, { method: 'PUT', body }),
  deleteRundown: (id) => request(`/admin/rundown/${id}`, { method: 'DELETE' }),
  tables: (opts) => (isMockMode() ? mock.tables() : request('/admin/tables', opts)),
  // The two prize draws (MoM 19 Aug 2026).
  draws: (opts) => request('/admin/draws', opts),
  drawPool: (key, opts) => request(`/admin/draws/${key}`, opts),
  drawPick: (key) => request(`/admin/draws/${key}/pick`, { method: 'POST' }),
  setDrawMinimum: (key, min) =>
    request(`/admin/draws/${key}/minimum`, { method: 'PUT', body: { min_booth_visits: min } }),
  resetDraw: (key) => request(`/admin/draws/${key}/winners`, { method: 'DELETE' }),
  // The speed-networking round: everyone counts down to the same moment.
  networkingSession: (opts) => request('/networking/session', opts),
  startNetworkingSession: (minutes) =>
    request('/admin/networking/session/start', { method: 'POST', body: { minutes } }),
  stopNetworkingSession: () => request('/admin/networking/session/stop', { method: 'POST' }),
  // Who is sitting where, while networking runs (MoM 19 Aug 2026).
  tableSeats: (opts) => request('/admin/tables/seats', opts),
  generateTables: (body) =>
    isMockMode() ? mock.generateTables(body) : request('/admin/tables/generate', { method: 'POST', body }),
  updateTable: (id, body) =>
    isMockMode() ? mock.updateTable(id, body) : request(`/admin/tables/${id}`, { method: 'PUT', body }),
  deleteTable: (id) =>
    isMockMode() ? mock.deleteTable(id) : request(`/admin/tables/${id}`, { method: 'DELETE' }),
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
