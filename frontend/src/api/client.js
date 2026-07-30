import { useAuthStore } from '../store/auth'
import { mockApi } from './mock'

const BASE = '/api/v1'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Fallback ramah saat server tidak mengirim pesan (mis. proxy error,
// rate limit, atau server tumbang).
const FRIENDLY_STATUS = {
  429: 'Terlalu banyak percobaan — tunggu sebentar lalu coba lagi.',
  500: 'Server sedang bermasalah. Coba beberapa saat lagi, atau gunakan Mode Demo (Mock).',
  502: 'Server tidak dapat dihubungi. Coba beberapa saat lagi.',
  503: 'Server sedang sibuk. Coba beberapa saat lagi.',
  504: 'Server terlalu lama merespons. Coba beberapa saat lagi.',
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
    throw new ApiError(0, 'Tidak bisa terhubung ke server — periksa koneksi, atau coba Mode Demo (Mock).')
  }

  if (res.status === 401 && path !== '/auth/login') {
    useAuthStore.getState().logout()
    throw new ApiError(401, 'Sesi kamu sudah berakhir — silakan login kembali.')
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
      data?.error || FRIENDLY_STATUS[res.status] || `Terjadi kesalahan (kode ${res.status}). Coba lagi ya.`
    )
  }
  return data
}

const isMock = () => useAuthStore.getState().mock

// Every call routes to the local mock layer when demo mode is on.
export const api = {
  login: (email, password) =>
    isMock() ? mockApi.login(email, password) : request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => (isMock() ? mockApi.me() : request('/me')),
  tenants: () => (isMock() ? mockApi.tenants() : request('/tenants')),
  seminars: () => (isMock() ? mockApi.seminars() : request('/seminars')),
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
  booth: () => (isMock() ? mockApi.booth() : request('/booth')),
  boothStats: () => (isMock() ? mockApi.boothStats() : request('/booth/stats')),
  boothVisitors: (limit = 10) =>
    isMock() ? mockApi.boothVisitors(limit) : request(`/booth/visitors?limit=${limit}`),
}
