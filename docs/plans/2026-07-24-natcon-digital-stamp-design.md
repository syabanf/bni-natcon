# BNI Natcon 2026 — Digital Stamp App: Design

Date: 2026-07-24
Status: Approved

## Goal

Turn the static mockup (`natcon2026-mockup_3.html`) into a working full-stack app:
a Go backend using clean architecture and a React (JavaScript) frontend on Vite.

## Decisions

| Question   | Decision |
|------------|----------|
| Database   | PostgreSQL 16 (Docker Compose for local dev) |
| Auth       | Simple JWT login (seeded accounts, bcrypt passwords) |
| QR         | Real QR codes; member QR encodes their member code; tenant scans with device camera (`html5-qrcode`) |
| Scope v1   | Member: home, my-QR, tenant passport, seminar registration. Tenant: scanner, dashboard. Speed networking deferred. |
| FE stack   | React 18 + Vite (JS), react-router, Zustand, qrcode.react |
| BE stack   | Go 1.22+, chi router, pgx v5, golang-jwt v5, hand-wired DI |

## Repository layout

```
├── backend/
│   ├── cmd/api/main.go            # composition root
│   ├── internal/
│   │   ├── config/                # env config
│   │   ├── domain/                # entities, repo interfaces, domain errors
│   │   ├── usecase/               # business rules (unit-tested, no infra deps)
│   │   ├── repository/postgres/   # pgx implementations + migration runner + seeder
│   │   └── delivery/http/         # chi router, handlers, JWT middleware, DTOs
│   └── migrations/                # embedded SQL, applied at startup
├── frontend/                      # React + Vite (JS)
└── docker-compose.yml             # PostgreSQL
```

Dependency rule: `domain` depends on nothing; `usecase` depends on `domain`;
`repository` and `delivery` depend inward. `cmd/api` wires everything.

## Domain model

- **User**: id, name, email, password_hash, role (`member` | `tenant`), member_code (`NATCON-2026-XXXXX`, members only), chapter, company.
- **Tenant**: id, name, category, booth code, initials, owner_user_id (the tenant-role login that operates the booth scanner).
- **Visit**: unique (tenant_id, member_id) — the digital stamp. Coupon count = member's visit count.
- **Seminar**: id, slot, room, title, speaker, capacity.
- **SeminarRegistration**: unique (member_id, slot) — one pick per parallel slot; capacity enforced in a transaction with row lock.

## API (`/api/v1`)

| Method & path                  | Role   | Purpose |
|--------------------------------|--------|---------|
| POST `/auth/login`             | public | email+password → JWT + profile |
| GET `/me`                      | any    | profile + stats (visits, coupons, seminar picked) |
| GET `/tenants`                 | member | all tenants with `visited` flag |
| GET `/seminars`                | member | seminars with seats left + `registered` flag |
| POST `/seminars/{id}/register` | member | register; 409 if full or already picked in slot |
| POST `/scans`                  | tenant | body `{member_code}`; records visit; 200 + `duplicate` flag |
| GET `/booth/stats`             | tenant | total scans, unique visitors today |
| GET `/booth/visitors`          | tenant | recent visitors (newest first) |

Domain errors map to HTTP: not found → 404, duplicate visit → 200 with
`duplicate: true` (scanner UX needs the member info either way), seminar full /
already registered → 409, bad credentials → 401.

## Frontend

Ports the mockup's visual system (CSS variables, cards, pills, bottom nav,
toast) into React components. Routes:

- `/login` — role-agnostic login.
- Member (bottom nav): `/` home, `/qr`, `/passport`, `/seminar`.
- Tenant (bottom nav): `/scanner`, `/dashboard` (polls every 5 s).

Member QR rendered with `qrcode.react` from the member code. Scanner uses
`html5-qrcode` (camera; needs localhost or HTTPS) with a manual-code fallback
input. Zustand keeps the JWT + profile in localStorage. Vite dev server proxies
`/api` to the Go server.

## Seed data

12 tenants (from the mockup), 2 parallel seminars (R. Merapi 60 seats,
R. Rinjani 40 seats), demo member `reddie@natcon.id`, a second member
`sinta@natcon.id`, and one tenant login per booth (`booth-a03@natcon.id`, …),
all password `natcon2026`.

## Testing

- Go: table-driven unit tests for usecases with in-memory repo fakes; `go vet`.
- FE: `npm run build` as the verification gate.

## Deferred

Speed networking screens, admin/export tooling, signed-QR anti-forgery,
WebSocket live dashboard (polling is enough for v1).
