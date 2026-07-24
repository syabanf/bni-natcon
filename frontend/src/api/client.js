import { useAuthStore } from '../store/auth'

const BASE = '/api/v1'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const token = useAuthStore.getState().token
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && path !== '/auth/login') {
    useAuthStore.getState().logout()
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
  me: () => request('/me'),
  tenants: () => request('/tenants'),
  seminars: () => request('/seminars'),
  registerSeminar: (id) => request(`/seminars/${id}/register`, { method: 'POST' }),
  unregisterSeminar: (id) => request(`/seminars/${id}/register`, { method: 'DELETE' }),
  scan: (memberCode) => request('/scans', { method: 'POST', body: { member_code: memberCode } }),
  booth: () => request('/booth'),
  boothStats: () => request('/booth/stats'),
  boothVisitors: (limit = 10) => request(`/booth/visitors?limit=${limit}`),
}
