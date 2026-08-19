# BNI Natcon 2026 — Digital Stamp App

[![CI](https://github.com/syabanf/bni-natcon/actions/workflows/ci.yml/badge.svg)](https://github.com/syabanf/bni-natcon/actions/workflows/ci.yml)

Event app for BNI Natcon 2026 — 3 September 2026 at **Pullman Central Park
Jakarta** — built from the `natcon2026-mockup_3.html` mockup. The entire UI is
in **English** (MoM revision). Members collect
**pins** by having sponsors & booths scan their QR (the passport opens with
an **Official Sponsors** band and red-framed, ribboned sponsor cards above
a plain Booths section, visited tenants sink to the bottom; every tenant
card carries a description), pick one of the four parallel **learning
classes** (**goodiebag on door check-in**, with a **separate class entry QR**,
full class detail carrying **speaker & moderator photos**, a cover, a live
attendance badge, and **who else is in the room**), and join **speed
networking** — **scan the table QR first** (or type the table number) to drop
straight into the table's network, where every person shows their **chapter**,
**business classification** and a **WhatsApp link**, takes a **private note**
straight from the seat, and whose contact details carry **email & phone** that
open the mail/phone app on tap. Tenants
scan member QRs — which carry the attendee's **ticket number**, the one
printed on their ticket — with the camera, or take **manual input by ticket
number / member ID / phone number**, keep **notes per visitor** (shown in the visitor list), and open
a **visitor detail** page from the booth dashboard. A separate admin app
gives the committee live monitoring (**Sponsors** and **Booths** are counted
as separate tiles), master-data CRUD (tenants have **booth/sponsor kind** +
description, with All/Sponsors/Booths filter tabs, a Kind column and tinted
sponsor rows; learning classes carry a **speaker list with uploadable
photos**, description + cover, a **seat quota you set straight from the
class list** — click the number, type, Enter — and the committee can
**register attendees into a class** by ticket number/member code/email/phone or **import
a whole registration sheet**),
**detail pages**, the **door check-in station**, a **Tables** page that
generates the speed-networking tables, a **QR Prints** page with
print-ready QR cards (tables, class rooms, booth signage, and the two
**sign-in doors**), and a **Lucky Draw** page with a card-shuffle animation
across **every registered attendee** — one ticket each, pins change nobody's
odds, and a winner drops out so no one is drawn twice — with a **stage mode**
that throws the draw fullscreen for the hall projector, driven from the
keyboard (Space draws, Esc leaves).

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
- **Frontend** (`frontend/`, port 5173): member + tenant app — React 18 + Vite (JS), react-router, Zustand, `qrcode.react`, `html5-qrcode`. It opens straight on a split sign-in screen (form on the left, "Accelerate" brand hero on the right); the account's role decides where you land. **Each app has its own path prefix** — attendees live under `/attendee` (`/attendee/qr`, `/passport`, `/seminar`, `/network`), booth & sponsor scanners under `/tenant` (`/tenant/scanner`, `/tenant/dashboard`). **Each audience also has its own sign-in door**: attendees get `/login`, booth crews get `/tenant/login`, which says *Booth Scanner*, explains the `booth-<code>@natcon.id` login pattern and drops the attendee-only password recovery. Signing in at the wrong door still works — the account's role decides where you land, so nobody is stranded at a desk with the wrong link — and logging out returns you to the door you came in by. Pre-split URLs still redirect to their new home.
- **Android APK** (`frontend/android/`): the same attendee + booth app,
  wrapped with Capacitor into **one APK people download and install
  directly** — no Play Store. `VITE_API_URL=https://… scripts/build-apk.sh`
  produces `dist/natcon2026-debug.apk`; the API address is baked in at build
  time because the APK carries its own assets and has no dev proxy to fall
  back on. Camera permission for the QR scanners, portrait-locked, BNI icon
  and an *Accelerate* splash, and the service worker is skipped on native so
  a stale cache can never outlive an install. Signing keys stay out of the
  repo. Full guide: [`docs/ANDROID.md`](docs/ANDROID.md).
- **Door crew** (`door/`, port 5175): the app on a learning class door —
  class attendance, goodiebags and pins, each scanned once per attendee, and
  nothing else. It is a separate app because the crew working a door should
  not be handed the committee's login, which also opens the attendee list,
  the master data and the draws. Signs in as `door@natcon.id`.
- **Admin** (`admin/`, port 5174): committee panel — React 18 + Vite (JS) with sidebar navigation. Live dashboard (overview, booth ranking, class fill, activity feed), master-data CRUD in modal popups, **Excel import** for attendees/tenants (SheetJS, flexible headers, create-or-update, with a **Download format** button that generates a ready-to-fill template), and three report pages (Tenant Leads, Class Registrations, Attendee Pins) — each with flat SVG-style charts (scans per booth/hour, seat fill, pin distribution) and its own Excel export.

Members can cancel a class registration (`DELETE /seminars/{id}/register`)
and pick another class in the same slot.

**Every learning class has a quota**, and rooms get re-sized right up to the
morning of the event. The Learning Classes page therefore shows each class as
`taken/quota` with a fill bar and either *N seats left* or **FULL**, and the
number itself is the control: click it, type the new quota, press Enter.
It posts `PATCH /admin/seminars/{id}/quota` — deliberately narrow, so
re-sizing a room can never blank the description, cover or speaker photos the
way a full update built from a list row would. A quota below the attendees
already registered is refused, by the quota cell, by the full edit form and by
the API itself (which names both numbers): shrinking a room must not silently
strand the people already in it. Setting the quota to exactly what is booked
is allowed — that is how you close registration early. Once a class is at
quota, both self-service and committee registration turn the next person
away.

**A fresh database holds the event's own master data and nothing invented:**

- **`admin@natcon.id`**, on `SEED_PASSWORD`. Set that before the event.
- **A draft rundown for 3 September** (migration `0024`): nine one-hour
  blocks from registration to the closing draw, including **two learning
  blocks** — an attendee may hold two classes only if the day has two hours
  to hold them in. Written only into an empty schedule, so a committee that
  has typed their own day keeps it and a deleted block never returns. The
  hours come from the ticket window and the shape of the programme; the
  Rundown page is where they get corrected.
- **The Gold Club Breakfast on 4 September** (migration `0025`). 66 tickets in
  the export are for the morning after, not the conference day — the schedule
  now holds both dates, the admin page groups blocks under the day they run
  on, and the attendee agenda names the day once there is more than one. The
  agenda is a single list for everybody, so the block says on it that it is
  for Gold Club tickets; filtering by ticket type is not built.
- **The 4 learning classes with their 9 speakers and moderators**, from the
  Term of Reference documents — written once and never rewritten, so a class
  edited in the admin panel survives a restart.
- **The 34 booths and 4 sponsors of the committee's booth sheet** (migration
  `0023`), each with its scanner login. The sheet's own *Sponsor* divider
  decides which is which, and an exhibitor holding two positions
  ("A18 & A20") gets a booth — and a printable QR — for each. Generated
  straight from the spreadsheet by
  [`scripts/booths_migration.py`](scripts/booths_migration.py) — edit the
  sheet, re-run the script, restart. It works in both directions: a booth
  already there keeps its login and its scans, and a booth that has left the
  sheet is removed *unless somebody has already scanned it*.

**Attendees are the one import.** They change until the last minute, and 769
people's names, emails and phone numbers do not belong in git. Their chapters
come with them: every import registers the chapter names it meets, so the
master list is exactly what the committee's sheet contains. **Networking
tables** are generated on the Tables page for the hall they actually get.

No demo attendee, placeholder booth or invented chapter exists anywhere.

Speaker photos live in [`assets/speakers/`](assets/speakers) and room posters
in [`assets/covers/`](assets/covers); both are served from each app's
`public/` folder. Photos uploaded through the admin speaker editor or the
cover picker go to the API's `UPLOAD_DIR` instead.

**Sign-in QR codes** for print and slides live in [`assets/qr/`](assets/qr) —
one for the attendee door (`/login`), one for the booth door
(`/tenant/login`), as SVG + PNG plus a ready-to-print A4 card sheet.
Regenerate them (and point them at another host) with
`python3 scripts/make_login_qr.py https://your-domain`. The committee can
also print the same two cards from **QR Prints → Sign-in Doors** in the admin
panel; that tab reads `VITE_PUBLIC_APP_URL` (default `https://bninatcon.com`)
and prints the address under each code, so a wrong host is visible before the
paper is cut.

**Image uploads** (class covers, speaker photos) are **scaled down in the
browser before they are sent** — 1600 px on the long edge, JPEG quality 0.82.
A 9.6 MB phone photo leaves as 499 KB, which is the difference between a
half-minute wait on venue WiFi and an instant one; the server was never the
slow part (~10 ms whatever the size). Files the browser cannot decode are
passed through untouched and the API explains them
([`admin/src/image.js`](admin/src/image.js)).

**Excel import (attendees & tenants)**: both master-data pages carry an
**Import Excel** button and a **Download format** button that generates a
ready-to-fill template (headers + example rows).

- *Attendees* — accepts the official ticketing export (*Data Peserta*
  sheet) as-is: combines First/Last Name (falling back to Ktp Name),
  normalizes phones (`'+62`, `08…` → `+62…`), maps *Bni Chapter* /
  *Company Name* / *Business Classification*, and skips duplicate emails
  inside the file. Rows
  **create-or-update by ticket number** when the sheet carries one (falling
  back to email), so **one buyer holding two tickets becomes two attendees**
  on the same address — signing in then asks **which pass you are**, and each
  pass keeps its own QR, pins and learning class. New accounts sign in with
  username = email and password = chapter + first name (lowercase, no
  spaces), then
  **choose their own password on that first sign-in** — nothing else in the
  app opens until they do. Forgot it? Recovery matches **chapter + the phone
  number on the ticket** (any of `+62…`/`62…`/`08…`, case- and
  space-insensitive on the chapter) and hands back a 15-minute reset token;
  both endpoints carry the same 10/minute/IP ceiling as sign-in.
- *Booths & sponsors* — accepts the official *Data Booth* sheet as-is
  (`Booth Number`, `Company Name`, `Business Classification`, `Name`,
  `BNI Chapter`): the company becomes the booth, the classification its
  category, and the person plus their chapter become the **booth contact**,
  shown in admin and under the booth's name on the attendee passport. The
  older headers still work — a sheet with only `Name` treats it as the
  booth's own name. Add `Kind` (`booth`/`sponsor`), `Initials`, `Email` and
  `Description` to control the rest; only a name and a booth code are
  required. Rows **create-or-update by booth code**: a new booth gets auto
  initials and an auto scanner login (`booth-<code>@natcon.id`, default
  password), an existing booth keeps its login and collected scans while its
  details are refreshed.

Both upload in chunks of 200 so big files never hit the request timeout,
and report `created / updated / failed` per import.

**Demo mock mode**: a toggle on both sign-in screens switches each app to a
localStorage-backed mock layer — no backend needed. In the member/tenant app
the state is shared across personas on the device (a booth scan shows up in
that member's passport); the admin app ships with seeded demo data (8 members,
12 demo booths, scattered scans for the charts) and full CRUD/import/report support.
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

### Hosting the apps and the API separately

Both apps call `/api/v1` on their own origin, which the Vite dev proxy and
the nginx image supply. A static host (Vercel, Netlify, S3) has no API to
serve, so those requests come back `404` — set **`VITE_API_URL`** to the
deployed API's origin at build time, and add the app's domain to the API's
`ALLOWED_ORIGINS`. Each app ships a `vercel.json` with the SPA fallback.
Full walkthrough incl. the 404/CORS checklist: [docs/DEPLOY.md](docs/DEPLOY.md).

## CI

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on
every push/PR: Go vet + unit tests, the 169-check E2E suite and the stress
suite against PostgreSQL service containers, Vitest + production builds of
both frontends, and `docker compose build` for all images.

Design doc: [docs/plans/2026-07-24-natcon-digital-stamp-design.md](docs/plans/2026-07-24-natcon-digital-stamp-design.md)

## QA

[`docs/qa/`](docs/qa) holds the scenario pack QA runs by hand before the event:
**118 cases** across sign-in, the attendee app, the booth scanner, admin master
data, event-day operations, reports and exports, and cross-cutting concerns
(devices, offline, demo mode, error states) — **77 of them P1**, meaning they
must pass before the doors open. Each case carries its precondition, the exact
steps, real test data and the expected result, with columns for the tester's
result and notes.

- [`natcon2026-qa-scenarios.xlsx`](docs/qa/natcon2026-qa-scenarios.xlsx) — the
  working copy, one sheet per area, with a Pass/Fail/Blocked/N/A dropdown
- [`qa-scenarios.md`](docs/qa/qa-scenarios.md) — the readable copy, regenerated
  from the workbook with `python3 scripts/qa_md_from_xlsx.py` so the two never
  drift apart

## Test reports

Measured runs, not estimates — each one says how to reproduce it:

| Report | What it covers |
| --- | --- |
| [Spreadsheet export — feature & performance](docs/reports/2026-08-10-export-test-report.md) ([xlsx](docs/reports/natcon2026-export-test-report.xlsx)) | All six exports: contents, awkward values, empty data, timings and file sizes at event scale, plus every endpoint's p50 |
| [k6 load test](docs/reports/2026-08-03-k6-load-test.md) ([xlsx](docs/reports/natcon2026-k6-report.xlsx)) | Attendee browsing, booth scanning and admin polling under concurrent load |
| [Load & concurrency](docs/reports/2026-08-03-load-test-report.md) ([xlsx](docs/reports/natcon2026-load-test-report.xlsx)) | Transactional correctness under contention up to 1,000 contenders |

[`scripts/seed_event_scale.sql`](scripts/seed_event_scale.sql) fills a fresh
database with the shape of a full Natcon day (≈700 attendees, 46 booths, 6.5k
scans, every networking seat taken) so any of these can be re-run.

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

## Accounts

A fresh database has exactly one login:

| Role  | Email             | Password        | Notes                             |
|-------|-------------------|-----------------|-----------------------------------|
| Admin | `admin@natcon.id` | `SEED_PASSWORD` | Committee dashboard + master data |

Everyone else is created by that account:

| Role     | Login                        | Password                                   |
|----------|------------------------------|--------------------------------------------|
| Attendee | the email on their ticket    | chapter + first name, then they choose their own · signs in at `/login` |
| Booth    | `booth-<code>@natcon.id`     | `SEED_PASSWORD`, or set in the admin panel · signs in at `/tenant/login` |

Booth logins are created automatically when a booth is added or imported, so
importing the booth sheet also hands out one scanner account per booth.

## API summary (`/api/v1`)

| Method & path                  | Role   | Purpose                                  |
|--------------------------------|--------|------------------------------------------|
| POST `/auth/login`             | public | email+password → JWT + profile           |
| GET `/me`                      | any    | profile + member stats                   |
| GET `/tenants`                 | member | tenants with `visited` flag              |
| GET `/seminars`                | member | seminars with seats left + `registered`  |
| GET `/seminars/{id}/attendees` | member | who else is in the room (names, chapters) |
| POST `/seminars/{id}/register` | member | register (409 when full/already picked)  |
| POST `/auth/password`          | member | choose a password on first sign-in       |
| POST `/auth/login/select`      | public | pick which pass to sign in as, when one email holds several |
| POST `/auth/forgot`            | public | chapter + ticket phone → one reset token per matching pass (rate-limited) |
| POST `/auth/reset`             | public | consume the reset token, set a password  |
| POST `/scans`                  | tenant | record visit — `member_code` accepts the **ticket number** the QR carries, a member code, or a phone number |
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
| POST `/admin/seminars/{id}/registrations` | admin | register an attendee by ticket number, member code, email, or phone |
| DELETE `/admin/seminars/{id}/registrations/{code}` | admin | drop a registration (and its attendance) |
| POST `/admin/seminars/registrations/bulk` | admin | import a registration sheet (attendee + room per row) |
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
