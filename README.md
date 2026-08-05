# BNI Natcon 2026 — Digital Stamp App

[![CI](https://github.com/syabanf/bni-natcon/actions/workflows/ci.yml/badge.svg)](https://github.com/syabanf/bni-natcon/actions/workflows/ci.yml)

Event app for BNI Natcon 2026, built from the `natcon2026-mockup_3.html`
mockup. The entire UI is in **English** (MoM revision). Members collect
**pins** by having sponsors & booths scan their QR (passport groups
**sponsors on top**, visited tenants sink to the bottom; every tenant card
carries a description), register for parallel seminars (**totebag on
door check-in**, with a **separate seminar entry QR**, full seminar detail
+ cover, and a live attendance badge), and join **speed networking** —
**scan the table QR first** (or type the table number) to drop straight
into the table's network, with per-person **notes** and contact details
carrying **email & phone** that open the mail/phone app on tap. Tenants
scan member QRs with the camera or **manual input by member ID / phone
number**, keep **notes per visitor** (shown in the visitor list), and open
a **visitor detail** page from the booth dashboard. A separate admin app
gives the committee live monitoring, master-data CRUD (tenants have
**booth/sponsor kind** + description; seminars have description + cover),
**detail pages**, the **door check-in station**, a **Tables** page that
generates the speed-networking tables, a **QR Prints** page with
print-ready QR cards (tables, seminar rooms, booth signage), and a
**Lucky Draw** page with a card-shuffle animation where every pin is a
ticket and top collectors lead the deck.

All UI follows the original mockup theme (Plus Jakarta Sans, rounded cards,
soft shadows, tinted pills, single red `#CF2030` accent) and carries the
official **BNI Indonesia National Conference 2026 — Accelerate** lockup.

**Brand assets** live in [`assets/brand/`](assets/brand) (the original
4500×4500 PNGs: stacked/horizontal × colored/white). Web-optimized,
transparent-margin-trimmed variants are served from each app's
`public/brand/` (`logo-horizontal.png`, `logo-horizontal-white.png`,
`logo-stacked.png`, `logo-stacked-white.png`), and the PWA icons /
favicons are generated from the BNI mark. Regenerate them with the
snippet in [`assets/brand/README.md`](assets/brand/README.md) after
dropping in new artwork.

- **Backend**: Go (clean architecture: `domain` → `usecase` → `repository` / `delivery`), chi, pgx, JWT, PostgreSQL
- **Frontend** (`frontend/`, port 5173): member + tenant app — React 18 + Vite (JS), react-router, Zustand, `qrcode.react`, `html5-qrcode`. It opens straight on a split sign-in screen (form on the left, "Accelerate" brand hero on the right); the account's role decides where you land. **Each app has its own path prefix** — attendees live under `/attendee` (`/attendee/qr`, `/passport`, `/seminar`, `/network`), booth & sponsor scanners under `/tenant` (`/tenant/scanner`, `/tenant/dashboard`), and sign-in is shared at `/login`. Pre-split URLs still redirect to their new home.
- **Admin** (`admin/`, port 5174): committee panel — React 18 + Vite (JS) with sidebar navigation. Live dashboard (overview, booth ranking, seminar fill, activity feed), master-data CRUD in modal popups, **Excel import** for attendees/tenants (SheetJS, flexible headers, create-or-update, with a **Download format** button that generates a ready-to-fill template), and three **Laporan** pages (Leads Tenant, Registrasi Seminar, Kupon Peserta) — each with flat SVG-style charts (scan per booth/jam, keterisian kursi, distribusi kupon) and its own Excel export.

Members can cancel a seminar registration (`DELETE /seminars/{id}/register`)
and pick another session in the same slot.

**Excel import (attendees & tenants)**: both master-data pages carry an
**Import Excel** button and a **Download format** button that generates a
ready-to-fill template (headers + example rows).

- *Attendees* — accepts the official ticketing export (*Data Peserta*
  sheet) as-is: combines First/Last Name (falling back to Ktp Name),
  normalizes phones (`'+62`, `08…` → `+62…`), maps *Bni Chapter* /
  *Company Name*, and skips duplicate emails inside the file. Rows
  **create-or-update by email**; new accounts sign in with username =
  email and password = chapter + first name (lowercase, no spaces).
- *Tenants* — headers Name/Booth/Category/Kind/Initials/Email/Description
  (only Name and Booth required). Rows **create-or-update by booth code**:
  a new booth gets auto initials and an auto scanner login
  (`booth-<code>@natcon.id`, default password), an existing booth keeps
  its login and collected scans while its details are refreshed.

Both upload in chunks of 200 so big files never hit the request timeout,
and report `created / updated / failed` per import.

**Demo mock mode**: a toggle on both sign-in screens switches each app to a
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
every push/PR: Go vet + unit tests, the 118-check E2E suite and the stress
suite against PostgreSQL service containers, Vitest + production builds of
both frontends, and `docker compose build` for all images.

Design doc: [docs/plans/2026-07-24-natcon-digital-stamp-design.md](docs/plans/2026-07-24-natcon-digital-stamp-design.md)

## Environment configuration

Predefined variable templates ship with the repo — copy, adjust, done
(every variable has a safe development default, so empty/no env also works):

```bash
cp .env.example .env                          # backend + docker compose
cp frontend/.env.example frontend/.env.local  # member/tenant dev server
cp admin/.env.example admin/.env.local        # admin dev server
```

- **`.env` (root)** — read automatically by both `docker compose` and the Go
  API (`go run ./backend/cmd/api` auto-loads `.env` from the working
  directory; real environment variables always take precedence). Holds
  `APP_ENV`, `JWT_SECRET`, `SEED_PASSWORD`, `ADDR`, `DATABASE_URL`,
  `ALLOWED_ORIGINS`, `UPLOAD_DIR` (local image storage, default `uploads`),
  plus compose-only knobs: `DB_USER/DB_PASSWORD/DB_NAME`,
  host ports (`DB_PORT`, `API_PORT`, `FRONTEND_PORT`, `ADMIN_PORT`) and
  `VITE_ADMIN_URL`.
- **`frontend/.env.local`** — `VITE_API_PROXY` (where the dev server proxies
  `/api`), `VITE_ADMIN_URL` (target of the "Admin Dashboard" tile).
- **`admin/.env.local`** — `VITE_API_PROXY`.

`.env` and `*.local` are gitignored; only the `.env.example` templates are
committed.

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

Defaults (override via env or the root `.env` — see
[Environment configuration](#environment-configuration)): `ADDR=:8080`,
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

**Printed QR codes** (admin → QR Prints): `TABLE:<no>` is what attendees
scan at Speed Networking to join a table; `SEMINAR:<id>` posted on a room
door switches the session on the Door Check-in page when the crew scans
it; `BOOTH:<code>` is booth/sponsor signage. Pick a size, tap cards to
include or exclude them, and print — only the selected cards reach paper.

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
| POST `/scans`                  | tenant | record visit — `member_code` accepts a member code **or phone number** |
| GET `/booth`                   | tenant | booth profile                            |
| GET `/booth/stats`             | tenant | total + today scan counts                |
| GET `/booth/visitors`          | tenant | recent visitors (incl. per-visitor note) |
| GET `/booth/visitors/{id}`, PUT `.../note` | tenant | visitor detail + lead note |
| GET `/networking`              | member | table list + my table, mates, saved flags |
| POST `/networking/checkin`     | member | check in / move table (409 when full)   |
| POST `/networking/contacts`(`/all`) | member | save one / all table-mate contacts |
| PUT `/networking/contacts/{id}/note` | member | private note on a saved contact |
| GET `/networking/history`      | member | table check-in log + saved contacts      |
| GET `/admin/{members,tenants,seminars}/{id}` | admin | detail pages         |
| GET `/admin/overview`          | admin  | event-wide stats                         |
| GET `/admin/tenants`           | admin  | booth ranking by scans                   |
| GET `/admin/seminars`          | admin  | seminar fill                             |
| GET `/admin/activity`          | admin  | recent scans across booths               |
| GET/POST `/admin/members`, PUT/DELETE `/admin/members/{id}`   | admin | member CRUD incl. phone (auto member code + login); list takes `?q=&page=&limit=` — q also matches phone |
| POST `/admin/tenants`, PUT/DELETE `/admin/tenants/{id}`       | admin | tenant CRUD (auto booth login)          |
| POST `/admin/seminars`, PUT/DELETE `/admin/seminars/{id}`     | admin | seminar CRUD                            |
| POST `/admin/seminars/{id}/checkin` | admin | door check-in by `member_code` (409 if not registered; duplicate flagged, not double-counted) |
| POST `/admin/uploads` | admin | multipart image upload (JPG/PNG/WEBP/GIF ≤5 MB) → stored locally in `UPLOAD_DIR`, served at GET `/uploads/{name}` — used for seminar covers |
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

End-to-end suite (118 checks: auth, role guards, scan by code & phone,
visitor notes/detail, seminar + door check-in/attendance, networking incl.
contact notes/email/phone, sponsor kinds, admin CRUD/import/reports,
pagination, metrics, hardening). Needs a **fresh database**:

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
