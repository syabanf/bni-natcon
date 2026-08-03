// k6 load test for the BNI Natcon 2026 API.
//
// Run against a FRESH database (setup seeds its own members):
//
//   createdb -O natcon natcon_k6
//   ADDR=:8084 DATABASE_URL=postgres://natcon:natcon@localhost:5432/natcon_k6?sslmode=disable \
//     go run ./backend/cmd/api &
//   BASE=http://localhost:8084 k6 run scripts/k6/load.js
//
// Scenarios (run concurrently, ~3 minutes total):
//   browse — attendee journey (me / tenants / seminars / networking),
//            ramping 0 → 60 VUs.
//   scan   — booth scanner firing POST /scans at a constant 20 rps.
//   admin  — committee dashboard polling (overview/tenants/seminars/activity).
//
// The login endpoint is rate-limited per IP, so setup() logs in with a
// unique X-Forwarded-For per request (RealIP middleware honors it).

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE = __ENV.BASE || 'http://localhost:8084'
const PASSWORD = __ENV.SEED_PASSWORD || 'natcon2026'
const MEMBER_LOGINS = 20
const SEED_MEMBERS = 200

const scanDuration = new Trend('scan_duration', true)
const scanErrors = new Rate('scan_errors')

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      exec: 'memberJourney',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '60s', target: 60 },
        { duration: '45s', target: 60 },
        { duration: '15s', target: 0 },
      ],
    },
    scan: {
      executor: 'constant-arrival-rate',
      exec: 'boothScan',
      rate: 20,
      timeUnit: '1s',
      duration: '2m30s',
      preAllocatedVUs: 30,
      maxVUs: 60,
    },
    admin: {
      executor: 'constant-vus',
      exec: 'adminDashboard',
      vus: 3,
      duration: '2m30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    'http_req_duration{scenario:browse}': ['p(95)<300'],
    'http_req_duration{scenario:scan}': ['p(95)<300'],
    'http_req_duration{scenario:admin}': ['p(95)<400'],
    checks: ['rate>0.99'],
    scan_errors: ['rate<0.01'],
  },
}

const jsonHeaders = { 'Content-Type': 'application/json' }

function login(email, password, xff) {
  const res = http.post(
    `${BASE}/api/v1/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { ...jsonHeaders, 'X-Forwarded-For': xff } }
  )
  if (res.status !== 200) {
    throw new Error(`login ${email} failed: ${res.status} ${res.body}`)
  }
  return res.json('token')
}

export function setup() {
  const adminTok = login('admin@natcon.id', PASSWORD, '10.66.0.1')
  const tenantTok = login('booth-a03@natcon.id', PASSWORD, '10.66.0.2')

  // Seed load-test members via the upsert import (idempotent on re-runs).
  // Generated password = chapter+firstname slug -> "chapterk6k6" for all.
  for (let start = 0; start < SEED_MEMBERS; start += 100) {
    const rows = []
    for (let i = start; i < Math.min(start + 100, SEED_MEMBERS); i++) {
      const n = String(i).padStart(4, '0')
      rows.push({
        name: `K6 Member ${n}`,
        email: `k6-${n}@natcon.id`,
        chapter: 'Chapter K6',
        phone: `+62899${n}000`,
      })
    }
    const res = http.post(`${BASE}/api/v1/admin/members/bulk`, JSON.stringify({ members: rows }), {
      headers: { ...jsonHeaders, Authorization: `Bearer ${adminTok}` },
    })
    if (res.status !== 200) {
      throw new Error(`bulk seed failed: ${res.status} ${res.body}`)
    }
  }

  const list = http.get(`${BASE}/api/v1/admin/members?q=k6-&limit=1000`, {
    headers: { Authorization: `Bearer ${adminTok}` },
  })
  const memberCodes = list.json('members').map((m) => m.member_code)

  const memberToks = []
  for (let i = 0; i < MEMBER_LOGINS; i++) {
    const n = String(i).padStart(4, '0')
    memberToks.push(login(`k6-${n}@natcon.id`, 'chapterk6k6', `10.66.1.${i + 1}`))
  }

  return { adminTok, tenantTok, memberToks, memberCodes }
}

const authGet = (path, token) =>
  http.get(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })

export function memberJourney(data) {
  const token = data.memberToks[__VU % data.memberToks.length]

  let res = authGet('/api/v1/me', token)
  check(res, { 'me 200': (r) => r.status === 200 })
  sleep(Math.random() * 0.7 + 0.3)

  res = authGet('/api/v1/tenants', token)
  check(res, {
    'tenants 200': (r) => r.status === 200,
    'tenants has sponsors first': (r) => r.json('tenants.0.kind') === 'sponsor',
  })
  sleep(Math.random() * 0.7 + 0.3)

  res = authGet('/api/v1/seminars', token)
  check(res, { 'seminars 200': (r) => r.status === 200 })
  sleep(Math.random() * 0.7 + 0.3)

  res = authGet('/api/v1/networking', token)
  check(res, { 'networking 200': (r) => r.status === 200 })
  sleep(Math.random() * 1.0 + 0.5)
}

export function boothScan(data) {
  const code = data.memberCodes[Math.floor(Math.random() * data.memberCodes.length)]
  const res = http.post(`${BASE}/api/v1/scans`, JSON.stringify({ member_code: code }), {
    headers: { ...jsonHeaders, Authorization: `Bearer ${data.tenantTok}` },
    tags: { name: 'POST /scans' },
  })
  scanDuration.add(res.timings.duration)
  scanErrors.add(res.status !== 200)
  check(res, {
    'scan 200': (r) => r.status === 200,
    'scan identifies member': (r) => String(r.json('member_name') || '').startsWith('K6 Member'),
  })
}

export function adminDashboard(data) {
  const t = data.adminTok
  check(authGet('/api/v1/admin/overview', t), { 'overview 200': (r) => r.status === 200 })
  check(authGet('/api/v1/admin/tenants', t), { 'ranking 200': (r) => r.status === 200 })
  check(authGet('/api/v1/admin/seminars', t), { 'fill 200': (r) => r.status === 200 })
  check(authGet('/api/v1/admin/activity?limit=15', t), { 'activity 200': (r) => r.status === 200 })
  sleep(1)
}
