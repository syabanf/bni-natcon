// Performance test — BNI Natcon 2026 (bni-natcon.reddie.id)
// Read-heavy: landing + API endpoints member/tenant.
// Login hanya di setup() (rate limit login: 10/IP/menit — dijaga).
import http from 'k6/http';
import { sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'https://bni-natcon.reddie.id';
const PASSWORD = __ENV.NATCON_PASS || 'natcon2026';
const MEMBER_EMAIL = 'reddie@natcon.id';
const TENANT_EMAIL = 'booth-a03@natcon.id';

const endpoints = [
  ['landing', 'GET', '/', 'public'],
  ['me', 'GET', '/api/v1/me', 'member'],
  ['tenants', 'GET', '/api/v1/tenants', 'member'],
  ['seminars', 'GET', '/api/v1/seminars', 'member'],
  ['networking', 'GET', '/api/v1/networking', 'member'],
  ['networking_history', 'GET', '/api/v1/networking/history', 'member'],
  ['booth_stats', 'GET', '/api/v1/booth/stats', 'tenant'],
];

const trends = {};
const failRates = {};
for (const [name] of endpoints) {
  trends[name] = new Trend(`trend_${name}`, true);
  failRates[name] = new Rate(`fail_${name}`);
}

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 10 },   // ramp-up
        { duration: '15s', target: 30 },   // naik ke 30 VU
        { duration: '60s', target: 30 },   // steady 30 VU
        { duration: '15s', target: 0 },    // ramp-down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export function setup() {
  const m = http.post(`${BASE}/api/v1/auth/login`, JSON.stringify({ email: MEMBER_EMAIL, password: PASSWORD }), { headers: { 'Content-Type': 'application/json' } });
  const t = http.post(`${BASE}/api/v1/auth/login`, JSON.stringify({ email: TENANT_EMAIL, password: PASSWORD }), { headers: { 'Content-Type': 'application/json' } });
  if (m.status !== 200 || t.status !== 200) {
    throw new Error(`setup login gagal: member=${m.status} tenant=${t.status}`);
  }
  return { memberToken: m.json('token'), tenantToken: t.json('token') };
}

export default function (data) {
  for (const [name, method, path, role] of endpoints) {
    const headers = { 'Content-Type': 'application/json' };
    if (role === 'member') headers.Authorization = `Bearer ${data.memberToken}`;
    if (role === 'tenant') headers.Authorization = `Bearer ${data.tenantToken}`;
    const res = http.request(method, BASE + path, null, { headers });
    const ok = res.status >= 200 && res.status < 300;
    trends[name].add(res.timings.duration);
    failRates[name].add(!ok);
  }
  sleep(0.2);
}

export function handleSummary(data) {
  const hd = data.metrics.http_req_duration.values;
  const hf = data.metrics.http_req_failed.values;
  const startedAt = Date.now() - data.metrics.http_req_duration.values.count * 0; // placeholder
  const eps = {};
  for (const [name, method, path] of endpoints) {
    const v = trends[name].values;
    const f = failRates[name].values;
    eps[name] = {
      method, path,
      count: v.count,
      avg_ms: v.avg, min_ms: v.min, med_ms: v.med, max_ms: v.max,
      p90_ms: v['p(90)'], p95_ms: v['p(95)'], p99_ms: v['p(99)'],
      fails: f.fails, fail_rate: f.rate,
    };
  }
  const summary = {
    generated_at: new Date().toISOString(),
    base_url: BASE,
    scenario: 'ramping-vus 0→10→30→30→0 (total 105s)',
    total_requests: data.metrics.http_reqs.values.count,
    aggregates: {
      avg_ms: hd.avg, min_ms: hd.min, med_ms: hd.med, max_ms: hd.max,
      p90_ms: hd['p(90)'], p95_ms: hd['p(95)'], p99_ms: hd['p(99)'],
      failed_rate: hf.rate,
    },
    thresholds: {
      http_req_duration: data.metrics.http_req_duration.thresholds.map((t) => ({ ok: t.ok, source: t.source })),
      http_req_failed: data.metrics.http_req_failed.thresholds.map((t) => ({ ok: t.ok, source: t.source })),
    },
    endpoints: eps,
  };
  return {
    'summary.json': JSON.stringify(summary, null, 2),
  };
}
