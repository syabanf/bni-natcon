// BNI Natcon 2026 — event-day rehearsal (3 September 2026).
//
// Reproduces the busiest minute of the day through the real public path:
// client -> Cloudflare edge -> cloudflared tunnel -> nginx -> Go API -> Postgres.
// Testing the API directly proves the API is fast; it does not prove the path
// the attendees actually use, and that path is the one with a tunnel in it.
//
// The dominant load is NOT login — it is polling. During speed networking every
// seated attendee refetches their table every 5 s and the session clock every
// 20 s (frontend/src/pages/member/Networking.jsx). At 1,000 attendees that is
// 1000/5 + 1000/20 = 250 req/s sustained, which dwarfs everything else.
//
//   python3 perf/eventday/mint-tokens.py --count 1000
//   BASE=https://bninatcon.com k6 run perf/eventday/eventday.js
//
// Read-only by default. WRITE=1 adds booth scans and seminar check-ins, which
// insert rows — point those at a scratch stack, never at production before
// the event.
//
// Roles are not interchangeable (see server.go): members own /networking and
// /seminars, booth crews (tenant) own /scans and /booth/*, door staff own
// seminar check-in and redemption, and only admin sees /admin/overview.

import http from 'k6/http'
import { check } from 'k6'
import { SharedArray } from 'k6/data'
import { Trend, Rate } from 'k6/metrics'

const BASE = __ENV.BASE || 'https://bninatcon.com'
const PEAK = Number(__ENV.PEAK || 1000)      // attendees in the hall
const WRITE = __ENV.WRITE === '1'
const RAMP = __ENV.RAMP || '30s'
const HOLD = __ENV.HOLD || '2m'

// SharedArray keeps one copy of the tokens across all VUs instead of one copy
// per VU; at 1,000 tokens the per-VU copy would be the memory bottleneck.
function pool(key) {
  return new SharedArray(key, () => JSON.parse(open('./tokens.json'))[key])
}
const attendees = pool('attendees')
const admins = pool('admins')
const doors = pool('doors')
const tenants = pool('tenants')

const pollLatency = new Trend('networking_poll_ms', true)
const errors = new Rate('unexpected_status')

// Rates derive from the polling intervals in the frontend, so they track PEAK
// automatically instead of being magic numbers.
const TABLE_RPS = Math.round(PEAK / 5)      // GET /networking          every 5 s
const SESSION_RPS = Math.round(PEAK / 20)   // GET /networking/session  every 20 s
const BROWSE_RPS = Math.max(5, Math.round(PEAK / 33))
const BOOTH_RPS = 8                         // 36 booths, crews watching their stats
const COMMITTEE_RPS = 4
const SCAN_RPS = 5
const CHECKIN_RPS = 3

function arrival(rate, fn) {
  return {
    executor: 'ramping-arrival-rate',
    exec: fn,
    startRate: Math.max(1, Math.round(rate / 10)),
    timeUnit: '1s',
    // Head-room so k6 itself is never the bottleneck being measured.
    preAllocatedVUs: Math.max(20, Math.round(rate * 1.5)),
    maxVUs: Math.max(50, rate * 4),
    stages: [
      { duration: RAMP, target: rate },
      { duration: HOLD, target: rate },
    ],
  }
}

export const options = {
  scenarios: {
    networking_table: arrival(TABLE_RPS, 'pollTable'),
    networking_clock: arrival(SESSION_RPS, 'pollSession'),
    browsing: arrival(BROWSE_RPS, 'browse'),
    booth_crew: arrival(BOOTH_RPS, 'boothCrew'),
    committee: arrival(COMMITTEE_RPS, 'committee'),
    ...(WRITE
      ? {
          booth_scan: arrival(SCAN_RPS, 'boothScan'),
          door_checkin: arrival(CHECKIN_RPS, 'doorCheckin'),
        }
      : {}),
  },
  thresholds: {
    // A phone that takes longer than a second to refresh a table feels broken
    // to someone standing in a hall waiting for it.
    'http_req_duration{expected_response:true}': ['p(95)<1000', 'p(99)<2000'],
    unexpected_status: ['rate<0.01'],
    networking_poll_ms: ['p(95)<1000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
  discardResponseBodies: true,
}

function auth(p, extra) {
  const t = p[Math.floor(Math.random() * p.length)]
  return { headers: Object.assign({ Authorization: `Bearer ${t}` }, extra || {}) }
}

function record(res, name) {
  const ok = res.status === 200
  errors.add(!ok)
  check(res, { [`${name} 200`]: () => ok })
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)]
}

export function pollTable() {
  const res = http.get(`${BASE}/api/v1/networking`, {
    ...auth(attendees), tags: { call: 'networking' },
  })
  pollLatency.add(res.timings.duration)
  record(res, 'networking')
}

export function pollSession() {
  record(http.get(`${BASE}/api/v1/networking/session`, {
    ...auth(attendees), tags: { call: 'session' },
  }), 'session')
}

// An attendee flipping between the agenda, the booth list and their own badge.
export function browse() {
  const p = pick(['/api/v1/me', '/api/v1/seminars', '/api/v1/tenants',
                  '/api/v1/rundown', '/api/v1/networking/history'])
  record(http.get(`${BASE}${p}`, { ...auth(attendees), tags: { call: 'browse' } }),
         'browse')
}

// Booth crews watch their own visitor count all day.
export function boothCrew() {
  const p = pick(['/api/v1/booth', '/api/v1/booth/stats', '/api/v1/booth/visitors'])
  record(http.get(`${BASE}${p}`, { ...auth(tenants), tags: { call: 'booth' } }), 'booth')
}

// The committee dashboard refreshes every 5 s on a handful of screens.
export function committee() {
  const p = pick(['/api/v1/admin/overview', '/api/v1/admin/tenants',
                  '/api/v1/admin/activity', '/api/v1/admin/tables/seats'])
  record(http.get(`${BASE}${p}`, { ...auth(admins), tags: { call: 'committee' } }),
         'committee')
}

// --- WRITE=1 only: these insert rows. Scratch stacks only. ---

// Booth crew scanning an attendee's badge QR.
export function boothScan() {
  const res = http.post(`${BASE}/api/v1/scans`,
    JSON.stringify({ member_code: `NATCON-2026-${9000 + (__ITER % 700)}` }),
    { ...auth(tenants, { 'Content-Type': 'application/json' }), tags: { call: 'scan' } })
  // A duplicate scan (409) and an unknown code (404) are both correct answers,
  // not failures — the point is that the server decides quickly and correctly.
  const ok = [200, 201, 404, 409].includes(res.status)
  errors.add(!ok)
  check(res, { 'scan handled': () => ok })
}

// Door staff checking an attendee into a seminar room.
export function doorCheckin() {
  const res = http.post(`${BASE}/api/v1/admin/seminars/1/checkin`,
    JSON.stringify({ member_code: `NATCON-2026-${9000 + (__ITER % 700)}` }),
    { ...auth(doors, { 'Content-Type': 'application/json' }), tags: { call: 'checkin' } })
  const ok = [200, 201, 400, 404, 409].includes(res.status)
  errors.add(!ok)
  check(res, { 'checkin handled': () => ok })
}
