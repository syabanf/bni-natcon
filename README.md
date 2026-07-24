# BNI Natcon 2026 — Digital Stamp App

Event app for BNI Natcon 2026, built from the `natcon2026-mockup_3.html` mockup.
Members collect digital "stamps" (door-prize coupons) by having tenants scan
their QR code, and register for parallel seminars. Tenants scan member QRs with
their device camera and watch a live booth dashboard. A separate admin app
gives the committee live monitoring plus master-data CRUD.

- **Backend**: Go (clean architecture: `domain` → `usecase` → `repository` / `delivery`), chi, pgx, JWT, PostgreSQL
- **Frontend** (`frontend/`, port 5173): member + tenant app — React 18 + Vite (JS), react-router, Zustand, `qrcode.react`, `html5-qrcode`. The landing page is a quick-access chooser (Aplikasi Peserta / Aplikasi Tenant / Admin Dashboard) with one-tap demo logins.
- **Admin** (`admin/`, port 5174): committee dashboard — React 18 + Vite (JS), Swiss-design UI. Live overview, booth ranking, seminar fill, activity feed, and master-data CRUD (peserta, tenant, seminar).

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
| GET `/admin/overview`          | admin  | event-wide stats                         |
| GET `/admin/tenants`           | admin  | booth ranking by scans                   |
| GET `/admin/seminars`          | admin  | seminar fill                             |
| GET `/admin/activity`          | admin  | recent scans across booths               |
| GET/POST `/admin/members`, PUT/DELETE `/admin/members/{id}`   | admin | member CRUD (auto member code + login)  |
| POST `/admin/tenants`, PUT/DELETE `/admin/tenants/{id}`       | admin | tenant CRUD (auto booth login)          |
| POST `/admin/seminars`, PUT/DELETE `/admin/seminars/{id}`     | admin | seminar CRUD                            |

## Tests

```bash
cd backend
go test ./...
```

## Deferred (v2 candidates)

Speed-networking screens, committee/admin role with visitor export, signed QR
payloads (anti-forgery), WebSocket live dashboard, code-splitting the scanner
page (html5-qrcode dominates the JS bundle).
