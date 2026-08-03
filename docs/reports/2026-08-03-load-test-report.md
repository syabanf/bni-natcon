# BNI Natcon 2026 — Load & Concurrency Test Report

> Date: 2026-08-03 · Host: MacBook Pro (M-series) · API: Go/chi + PostgreSQL 17 (localhost)
> Commit: `d4c8247` (MoM revision) · Suites: `scripts/e2e.py` (84 checks) + `scripts/stress.py` (12 assertions/level)

## 1. End-to-end suite

**84 passed / 0 failed** on a fresh database — auth & role guards, scan by
member code & phone, visitor notes/detail, seminars + door check-in/attendance, full
networking incl. contact notes/email/phone, sponsor kinds, admin CRUD/import/reports,
pagination & search, `/metrics`, and hardening probes (oversized body, rate limit).

## 2. Read-throughput ladder (up to 1,000 concurrent connections)

| Level | Workers | Total requests | Duration | Throughput | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|---|
| 1 | 40 | 2,400 | 0.18s | **13,640 req/s** | 2.2 ms | 7.1 ms | 11.3 ms | 30.1 ms |
| 2 | 100 | 10,000 | 0.61s | **16,385 req/s** | 4.7 ms | 13.5 ms | 20.0 ms | 33.4 ms |
| 3 | 200 | 20,000 | 1.25s | **16,059 req/s** | 9.5 ms | 27.6 ms | 40.4 ms | 75.2 ms |
| 4 | 300 | 18,000 | 1.16s | **15,536 req/s** | 11.6 ms | 34.4 ms | 49.5 ms | 102.7 ms |
| 5 | 500 | 30,000 | 2.57s | **11,651 req/s** | 17.5 ms | 49.8 ms | 72.5 ms | 184.5 ms |
| 6 | 1,000 | 30,000 | 2.39s | **12,573 req/s** | 25.1 ms | 81.8 ms | 150.1 ms | 270.0 ms |

All read requests returned pure HTTP 200 at every level — zero 5xx, zero connection errors.

## 3. Correctness under contention

| Contenders | Seminar seats (cap 10) | Table seats (cap 8) | 100-scan burst | Verdict |
|---|---|---|---|---|
| 60 | `{201: 10, 409: 50}` | `{200: 8, 409: 52}` | all 200 · **1** counted | ✅ 12/12 |
| 100 | `{201: 10, 409: 90}` | `{200: 8, 409: 92}` | all 200 · **1** counted | ✅ 12/12 |
| 200 | `{201: 10, 409: 190}` | `{200: 8, 409: 192}` | all 200 · **1** counted | ✅ 12/12 |
| 300 | `{201: 10, 409: 290}` | `{200: 8, 409: 292}` | all 200 · **1** counted | ✅ 12/12 |
| 500 | `{201: 10, 409: 490}` | `{200: 8, 409: 492}` | all 200 · **1** counted | ✅ 12/12 |
| 1,000 | `{201: 10, 409: 990}` | `{200: 8, 409: 992}` | all 200 · **1** counted | ✅ 12/12 |

Reading the columns: `{201: 10, 409: n}` = exactly 10 registrations accepted (never oversold),
`{200: 8, 409: n}` = exactly 8 seated at the table, and the scan burst always counts exactly
one new visit no matter how many concurrent duplicates arrive.

## 4. Conclusion

- Transactional guards (`FOR UPDATE` on seminar/table capacity, unique constraint on visits)
  hold perfectly from 60 to **1,000 concurrent contenders** — no oversell, no double-count.
- Throughput stays in the 11–15k req/s band across the whole ladder; worst-case p99 is
  ~150 ms at 1,000 concurrent connections — far under the 500 ms budget.
- API logs were clean (zero ERROR lines) across every run.

Raw outputs per level ship in `natcon2026-load-test-report.xlsx` (sheets `Raw c60` … `Raw c1000`).
