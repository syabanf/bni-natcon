/*
 * The door app talks to the same API as everything else, but to a very small
 * part of it: the class list, the check-in, and the two handovers. A door
 * account cannot reach anything else — the server refuses, and this file has
 * nothing else in it either.
 */
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const BASE = `${API_ORIGIN}/api/v1`
const TOKEN_KEY = 'natcon-door-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

const FRIENDLY_STATUS = {
  401: 'Your session has expired — please sign in again.',
  403: 'This account cannot do that. Sign in with a door account.',
  404: 'The API is not reachable at this address.',
  429: 'Too many attempts — wait a moment and try again.',
  500: 'The server is having trouble. Try again shortly.',
  502: 'The server cannot be reached. Try again shortly.',
  503: 'The server is busy. Try again shortly.',
  504: 'The server took too long to respond. Try again shortly.',
}

export class ApiError extends Error {
  // `body` carries the whole reply: a second goodiebag scan comes back with
  // who collected it and when, and the crew needs to see that.
  constructor(status, message, body = null) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request(path, { method = 'GET', body, onUnauthorized } = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server — check the venue wifi.')
  }
  // A 401 means two different things. Signing in with the wrong password is
  // not an expired session, and telling the crew their session expired while
  // they are staring at the sign-in form helps nobody.
  if (res.status === 401 && path !== '/auth/login') {
    clearToken()
    onUnauthorized?.()
    throw new ApiError(401, FRIENDLY_STATUS[401])
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error || FRIENDLY_STATUS[res.status] || `Something went wrong (code ${res.status}).`,
      data,
    )
  }
  return data
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),
  me: (opts) => request('/me', opts),
  seminars: (opts) => request('/admin/seminars', opts),
  seminarDetail: (id, opts) => request(`/admin/seminars/${id}`, opts),
  seminarCheckin: (id, memberCode) =>
    request(`/admin/seminars/${id}/checkin`, { method: 'POST', body: { member_code: memberCode } }),
  redeem: (memberCode, item) =>
    request('/admin/redeem', { method: 'POST', body: { member_code: memberCode, item } }),
  redeemCounts: (opts) => request('/admin/redeem/counts', opts),
}
