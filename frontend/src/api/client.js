import { useAuthStore } from '../store/auth'
import { mockApi } from './mock'

// Where the Go API lives. Empty (the default) means "same origin", which is
// what the Vite dev proxy and the nginx image both provide. Static hosts that
// only serve the built SPA (Vercel, Netlify, S3) have no /api to serve, so
// point VITE_API_URL at the deployed API instead — e.g.
// VITE_API_URL=https://api.natcon.example.com
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const BASE = `${API_ORIGIN}/api/v1`

// Uploaded images (seminar covers) are served by the API; everything else —
// speaker photos, brand art — ships with the static app itself.
export function assetUrl(path) {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/.test(path)) return path
  if (!path.startsWith('/uploads/')) return path
  return API_ORIGIN + path
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Friendly fallbacks when the server sends no message (proxy errors,
// rate limits, downtime).
const FRIENDLY_STATUS = {
  404: 'The API is not reachable at this address. If this is a hosted build, VITE_API_URL is missing or wrong.',
  429: 'Too many attempts — wait a moment and try again.',
  500: 'The server is having trouble. Try again shortly, or switch to Demo (Mock) mode.',
  502: 'The server cannot be reached. Try again shortly.',
  503: 'The server is busy. Try again shortly.',
  504: 'The server took too long to respond. Try again shortly.',
}

async function request(path, { method = 'GET', body } = {}) {
  const token = useAuthStore.getState().token
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
    throw new ApiError(0, 'Cannot reach the server — check your connection, or try Demo (Mock) mode.')
  }

  if (res.status === 401 && path !== '/auth/login') {
    useAuthStore.getState().logout()
    throw new ApiError(401, 'Your session has expired — please log in again.')
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    /* empty/non-JSON body (proxy error page etc.) */
  }
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error || FRIENDLY_STATUS[res.status] || `Something went wrong (code ${res.status}). Please try again.`
    )
  }
  return data
}

const isMock = () => useAuthStore.getState().mock

// Every call routes to the local mock layer when demo mode is on.
export const api = {
  login: (email, password) =>
    isMock() ? mockApi.login(email, password) : request('/auth/login', { method: 'POST', body: { email, password } }),
  selectAccount: (choiceToken, userId) =>
    isMock()
      ? mockApi.selectAccount(choiceToken, userId)
      : request('/auth/login/select', { method: 'POST', body: { choice_token: choiceToken, user_id: userId } }),
  me: () => (isMock() ? mockApi.me() : request('/me')),
  setPassword: (password) =>
    isMock() ? mockApi.setPassword(password) : request('/auth/password', { method: 'POST', body: { password } }),
  forgotPassword: (chapter, phone) =>
    isMock()
      ? mockApi.forgotPassword(chapter, phone)
      : request('/auth/forgot', { method: 'POST', body: { chapter, phone } }),
  resetPassword: (resetToken, password) =>
    isMock()
      ? mockApi.resetPassword(resetToken, password)
      : request('/auth/reset', { method: 'POST', body: { reset_token: resetToken, password } }),
  tenants: () => (isMock() ? mockApi.tenants() : request('/tenants')),
  seminars: () => (isMock() ? mockApi.seminars() : request('/seminars')),
  seminarAttendees: (id) =>
    isMock() ? mockApi.seminarAttendees(id) : request(`/seminars/${id}/attendees`),
  registerSeminar: (id) =>
    isMock() ? mockApi.registerSeminar(id) : request(`/seminars/${id}/register`, { method: 'POST' }),
  unregisterSeminar: (id) =>
    isMock() ? mockApi.unregisterSeminar(id) : request(`/seminars/${id}/register`, { method: 'DELETE' }),
  scan: (memberCode) =>
    isMock() ? mockApi.scan(memberCode) : request('/scans', { method: 'POST', body: { member_code: memberCode } }),
  networking: () => (isMock() ? mockApi.networking() : request('/networking')),
  networkingHistory: () =>
    isMock() ? mockApi.networkingHistory() : request('/networking/history'),
  networkingTableDetail: (tableNo) =>
    isMock() ? mockApi.networkingTableDetail(tableNo) : request(`/networking/tables/${tableNo}`),
  networkingContactDetail: (id) =>
    isMock() ? mockApi.networkingContactDetail(id) : request(`/networking/contacts/${id}`),
  networkingCheckIn: (tableNo) =>
    isMock()
      ? mockApi.networkingCheckIn(tableNo)
      : request('/networking/checkin', { method: 'POST', body: { table_no: tableNo } }),
  saveContact: (memberId) =>
    isMock()
      ? mockApi.saveContact(memberId)
      : request('/networking/contacts', { method: 'POST', body: { member_id: memberId } }),
  saveAllContacts: () =>
    isMock() ? mockApi.saveAllContacts() : request('/networking/contacts/all', { method: 'POST' }),
  setContactNote: (id, note) =>
    isMock()
      ? mockApi.setContactNote(id, note)
      : request(`/networking/contacts/${id}/note`, { method: 'PUT', body: { note } }),
  booth: () => (isMock() ? mockApi.booth() : request('/booth')),
  boothStats: () => (isMock() ? mockApi.boothStats() : request('/booth/stats')),
  boothVisitors: (limit = 10) =>
    isMock() ? mockApi.boothVisitors(limit) : request(`/booth/visitors?limit=${limit}`),
  visitorDetail: (memberId) =>
    isMock() ? mockApi.visitorDetail(memberId) : request(`/booth/visitors/${memberId}`),
  setVisitorNote: (memberId, note) =>
    isMock()
      ? mockApi.setVisitorNote(memberId, note)
      : request(`/booth/visitors/${memberId}/note`, { method: 'PUT', body: { note } }),
}
