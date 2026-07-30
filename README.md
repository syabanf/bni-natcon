# BNI Natcon 2026 — Digital Stamp App

[![CI](https://github.com/syabanf/bni-natcon/actions/workflows/ci.yml/badge.svg)](https://github.com/syabanf/bni-natcon/actions/workflows/ci.yml)

Event app for BNI Natcon 2026, built from the `natcon2026-mockup_3.html` mockup.
Members collect digital "stamps" (door-prize coupons) by having tenants scan
their QR code, register for parallel seminars, and join **speed networking**
(check in at a table of 8 — everyone at the table is auto-connected and can
save each other as contacts). Tenants scan member QRs with their device camera
and watch a live booth dashboard. A separate admin app gives the committee
live monitoring, master-data CRUD, **detail pages** per peserta/tenant/
seminar (profile, visit history, leads, attendee lists), and a **door
check-in station** (Check-in Pintu): scan attendee QRs at the seminar-room
door — attendance (hadir vs terdaftar) is tracked live and flows into the
seminar detail page and the registration report.

All UI follows the original mockup theme (Plus Jakarta Sans, rounded cards,
soft shadows, tinted pills, single red `#CF2030` accent).

- **Backend**: Go (clean architecture: `domain` → `usecase` → `repository` / `delivery`), chi, pgx, JWT, PostgreSQL
- **Frontend** (`frontend/`, port 5173): member + tenant app — React 18 + Vite (JS), react-router, Zustand, `qrcode.react`, `html5-qrcode`. The landing page is a quick-access chooser (Aplikasi Peserta / Aplikasi Tenant / Admin Dashboard) with one-tap demo logins.
- **Admin** (`admin/`, port 5174): committee panel — React 18 + Vite (JS) with sidebar navigation. Live dashboard (overview, booth ranking, seminar fill, activity feed), master-data CRUD in modal popups, **Excel import** for peserta/tenant (SheetJS; headers Nama/Email/Chapter/Perusahaan or Nama/Kategori/Booth), and three **Laporan** pages (Leads Tenant, Registrasi Seminar, Kupon Peserta) — each with flat SVG-style charts (scan per booth/jam, keterisian kursi, distribusi kupon) and its own Excel export.

Members can cancel a seminar registration (`DELETE /seminars/{id}/register`)
and pick another session in the same slot.

**Demo mock mode**: toggle buttons on both login pages switch each app to a
localStorage-backed mock layer — no backend needed. In the member/tenant app
the state is shared across personas on the device (a booth scan shows up in
that member's passport); the admin app ships with seeded demo data (8 members,
12 booths, scattered scans for the charts) and full CRUD/import/report support.
A red DEMO chip marks the mode; in mock mode any password is accepted.

**PWA / offline**: the member/tenant app installs as a PWA (manifest + service
worker, production builds only) — the app shell is cached so it opens without a
network, and tenant scans made while offline are queued in localStorage and
auto-synced when the connection returns (or via a "sinkronkan sekarang"
button). The heavy `html5-qrcode` scanner page is lazy-loaded into its own
chunk, so first paint stays light.

## One-command deploy (Docker)

```bash
docker compose up -d --build
```

Runs the whole stack: PostgreSQL, the Go API (`:8090` on the host), the
member/tenant app at **http://localhost:8088**, and the admin panel at
**http://localhost:8089** — nginx in each frontend image serves the static
build and proxies `/api` to the API container, so no CORS setup is needed.
Set `JWT_SECRET` and `APP_ENV=production` in the environment for real
deployments. For local development, start only the database with
`docker compose up -d db` and run the API/dev servers as described above.

## CI

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on
every push/PR: Go vet + unit tests, the 73-check E2E suite and the stress
suite against PostgreSQL service containers, Vitest + production builds of
both frontends, and `docker compose build` for all images.

Design doc: [docs/plans/2026-07-24-natcon-digital-stamp-design.md](docs/plans/2026-07-24-natcon-digital-stamp-design.md)

## Run it

### 1. Database

```bash
docker compose up -d
```

(Any PostgreSQL 14+ works; set `DATABASE_URL` accordingly.)

### 2. Backend

```bash
cd backend
go run ./cmd/api
```

Defaults (override via env): `ADDR=:8080`,
`DATABASE_URL=postgres://natcon:natcon@localhost:5432/natcon?sslmode=disable`,
`JWT_SECRET=dev-secret-change-me`, `SEED_PASSWORD=natcon2026`.

Migrations run automatically at startup; demo data is seeded when the DB is empty.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` to `localhost:8080`;
if your API runs elsewhere, put `VITE_API_PROXY=http://localhost:<port>` in
`frontend/.env.local`.

### 4. Admin dashboard

```bash
cd admin
npm install
npm run dev
```

Open http://localhost:5174 (same `VITE_API_PROXY` override via
`admin/.env.local`; the frontend's "Admin Dashboard" quick-access tile points
here — override with `VITE_ADMIN_URL` in `frontend/.env.local` if deployed
elsewhere).

> Camera scanning needs a secure context: `localhost` works out of the box; on
> a phone over LAN you need HTTPS (e.g. `vite --host` + a tunnel such as
> ngrok/tailscale). The scanner page also has a manual-code input fallback.

## Demo accounts

All with password `natcon2026`:

| Role    | Email                 | Notes                             |
|---------|-----------------------|-----------------------------------|
| Member  | `reddie@natcon.id`    | Member code `NATCON-2026-08154`   |
| Member  | `sinta@natcon.id`     | Member code `NATCON-2026-08201`   |
| Member  | `agus@natcon.id`      | Member code `NATCON-2026-08322`   |
| Tenant  | `booth-a03@natcon.id` | Kopi Nusantara · Booth A-03       |
| Tenant  | `booth-b01@natcon.id` | TechNesia Solutions · Booth B-01  |
| Tenant  | …one per booth        | `booth-<code>@natcon.id`          |
| Admin   | `admin@natcon.id`     | Committee dashboard + master data |

## API summary (`/api/v1`)

| Method & path                  | Role   | Purpose                                  |
|--------------------------------|--------|------------------------------------------|
| POST `/auth/login`             | public | email+password → JWT + profile           |
| GET `/me`                      | any    | profile + member stats                   |
| GET `/tenants`                 | member | tenants with `visited` flag              |
| GET `/seminars`                | member | seminars with seats left + `registered`  |
| POST `/seminars/{id}/register` | member | register (409 when full/already picked)  |
| POST `/scans`                  | tenant | record visit from `member_code`          |
| GET `/booth`                   | tenant | booth profile                            |
| GET `/booth/stats`             | tenant | total + today scan counts                |
| GET `/booth/visitors`          | tenant | recent visitors                          |
| GET `/networking`              | member | table list + my table, mates, saved flags |
| POST `/networking/checkin`     | member | check in / move table (409 when full)   |
| POST `/networking/contacts`(`/all`) | member | save one / all table-mate contacts |
| GET `/networking/history`      | member | table check-in log + saved contacts      |
| GET `/admin/{members,tenants,seminars}/{id}` | admin | detail pages         |
| GET `/admin/overview`          | admin  | event-wide stats                         |
| GET `/admin/tenants`           | admin  | booth ranking by scans                   |
| GET `/admin/seminars`          | admin  | seminar fill                             |
| GET `/admin/activity`          | admin  | recent scans across booths               |
| GET/POST `/admin/members`, PUT/DELETE `/admin/members/{id}`   | admin | member CRUD (auto member code + login); list takes `?q=&page=&limit=` (search + pagination, default limit 50, max 1000) |
| POST `/admin/tenants`, PUT/DELETE `/admin/tenants/{id}`       | admin | tenant CRUD (auto booth login)          |
| POST `/admin/seminars`, PUT/DELETE `/admin/seminars/{id}`     | admin | seminar CRUD                            |
| POST `/admin/seminars/{id}/checkin` | admin | door check-in by `member_code` (409 if not registered; duplicate flagged, not double-counted) |
| GET `/metrics`                 | public | Prometheus metrics (request count + latency histograms) |

## Tests

Unit tests (usecase layer, table-driven with fakes):

```bash
cd backend
go test ./...
```

Frontend tests (Vitest, mock-layer behavior in both apps):

```bash
cd frontend && npm test
cd admin && npm test
```

End-to-end suite (73 checks: auth, role guards, scan, seminar + door
check-in/attendance, networking, admin CRUD/import/reports, pagination,
metrics, hardening). Needs a **fresh database**:

```bash
createdb natcon_e2e   # or: CREATE DATABASE natcon_e2e;
ADDR=:8082 DATABASE_URL="postgres://natcon:natcon@localhost:5432/natcon_e2e?sslmode=disable" \
  go run ./backend/cmd/api &
BASE=http://localhost:8082 python3 scripts/e2e.py
```

Stress & concurrency suite (read-heavy load with latency percentiles, plus
correctness under contention: seminar seats, networking tables, scan bursts —
worker tokens are minted locally so the login rate limit stays untouched):

```bash
createdb natcon_stress
ADDR=:8083 DATABASE_URL="postgres://natcon:natcon@localhost:5432/natcon_stress?sslmode=disable" \
  go run ./backend/cmd/api &
BASE=http://localhost:8083 python3 scripts/stress.py
# heavier: WORKERS=100 REQS=100 CONTENDERS=100 BASE=... python3 scripts/stress.py
```

Reference numbers (M-series laptop, 10k requests): ~10,000 req/s,
p50 7 ms / p99 45 ms, zero errors; 100 members racing for 10 seminar seats →
exactly 10 succeed; 100 racing for an 8-seat table → exactly 8; 100
concurrent scans of one member → exactly 1 counted.

## Hardening

- HTTP server timeouts (read/write/idle/header) + graceful shutdown on SIGINT/SIGTERM
- Per-request 30 s timeout, 2 MiB request-body cap
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store`)
- Login rate limit: 10 attempts/IP/minute (429 after)
- CORS origins configurable via `ALLOWED_ORIGINS` (comma-separated)
- Refuses to start with the default `JWT_SECRET` when `APP_ENV=production`
- Email format validation on admin-created accounts
- Prometheus metrics at `/metrics` (`natcon_http_requests_total` by
  method/code, `natcon_http_request_duration_seconds` histogram)

## Deferred (v2 candidates)

Signed QR payloads (anti-forgery), WebSocket live dashboard, background sync
API for the offline scan queue, per-seminar door-crew accounts.
