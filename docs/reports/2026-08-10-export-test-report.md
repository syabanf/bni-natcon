# BNI Natcon 2026 — Spreadsheet Export: Feature & Performance Test

> Date: 2026-08-10 · Admin app (React 18 + Vite, production build) · API: Go/chi + PostgreSQL 17
> Dataset: [`scripts/seed_event_scale.sql`](../../scripts/seed_event_scale.sql) — 703 attendees,
> 46 booths, 6,467 booth scans, 703 class registrations, every networking seat taken
> Workbook: [`natcon2026-export-test-report.xlsx`](natcon2026-export-test-report.xlsx)

The app produces **six** spreadsheets: three reports and three import templates.
All six were tested for what they contain and how long they take.

## Feature — all six produce a valid file

Driven through the real UI: each button clicked, the download intercepted, and
the produced bytes inspected (`PK\x03\x04` zip header containing `workbook.xml`
and `sheet1.xml`).

| Page | Button | File | Rows |
|---|---|---|---|
| Report — Tenant Leads | Export Excel | `natcon2026-tenant-leads.xlsx` | 6,467 |
| Report — Class Registrations | Export Excel | `natcon2026-class-registrations.xlsx` | 703 |
| Report — Attendee Pins | Export Excel | `natcon2026-attendee-pins.xlsx` | 703 |
| Master Data — Attendees | Download format | `natcon2026-template-import-attendees.xlsx` | 2 |
| Master Data — Tenants | Download format | `natcon2026-template-import-booths.xlsx` | 2 |
| Master Data — Breakout Classes | Download format | `natcon2026-template-import-class-registrations.xlsx` | 2 |

## Feature — what is inside the file

The export code used to write a file as a side effect, so nothing could assert
its contents. Workbook building is now split from the download
(`buildWorkbook`, `buildTemplateWorkbook`) and
[`admin/src/export.test.js`](../../admin/src/export.test.js) reads each workbook
back the way Excel does — sheet name, header row, cell types, values:

- **Sheet name and header row** match the documented columns, in order.
- **Row count** equals the number of records; a silently short export is worse than none.
- **Slot and pin count stay numbers** — so the sheet sorts and filters. Zero pins
  arrive as `0`, not blank; that number decides lucky-draw tickets.
- **Timestamps stay ISO-8601**, which sorts correctly as text in Excel and Sheets.
- **Awkward text survives**: `Hukum & Rekan`, `Café`, `CV. TRIANA BINTANG, Tbk & Rekan`,
  quotes, commas, em dashes, non-ASCII.
- **Values that look like formulas stay text.** Names and companies come from an
  imported sheet, so some start with `=` or `+`. SheetJS writes them as string
  cells and Excel shows them literally — verified no cell in any workbook carries
  a formula. Prefixing an apostrophe (the CSV-era habit) was tried and reverted:
  it would have corrupted legitimate names like `+62 Studio`.
- **Every template round-trips** — the file handed to the committee is parsed back
  through the same importer, so a template whose own example rows are rejected
  fails the build.
- **Nothing to export → no export.** On a database with no scans and no
  registrations, both report buttons are disabled.

## Performance — the exports

Measured in the browser from the click to the file being handed to the download.

| Export | Rows | Build + write | File |
|---|---|---|---|
| Tenant Leads | 6,467 | 339 ms | 2.2 MB |
| Class Registrations | 703 | 24 ms | 289 KB |
| Attendee Pins | 703 | 22 ms | 197 KB |
| Template — attendees | 2 | 5 ms | 17 KB |
| Template — booths | 2 | 4 ms | 17 KB |
| Template — class registrations | 2 | 3 ms | 16 KB |
| **Tenant Leads — worst case** | **32,338** | **825 ms** | **10.7 MB** |

The worst case is every attendee visiting every booth. It still completes without
freezing the page; 10.7 MB is simply awkward to email. If that becomes real, the
export can be split per booth.

## Performance — the pages behind them

Seven calls per endpoint against the same dataset. **No endpoint exceeds 20 ms at p50.**

| Endpoint | p50 | max | Payload |
|---|---|---|---|
| `GET /admin/overview` | 3.7 ms | 7.6 ms | 0.2 KB |
| `GET /admin/tenants` | 3.5 ms | 4.5 ms | 9.9 KB |
| `GET /admin/members?page=1&limit=50` | 2.4 ms | 3.7 ms | 10.4 KB |
| `GET /admin/report/visits` | 16.8 ms | 48.2 ms | 1,289 KB |
| `GET /admin/report/registrations` | 4.1 ms | 7.1 ms | 176 KB |
| `GET /me` | 0.8 ms | 1.8 ms | 0.3 KB |
| `GET /tenants` | 0.7 ms | 1.4 ms | 9.8 KB |
| `GET /networking` | 1.1 ms | 2.4 ms | 6.9 KB |
| `GET /booth/visitors?limit=10` | 0.7 ms | 1.6 ms | 2.0 KB |

Full list in sheet **05 Perf - pages** of the workbook.

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | High | Lucky Draw and the pin report read one page of 1,000 and ignored the total — past 1,000 attendees the draw silently leaves people out | Fixed |
| 2 | High | `parseTableCode` anchored only at the end, so a member code's tail read as a table number and seated the scanner at table 1 | Fixed |
| 3 | Medium | Asking for more than the page cap returned the default 50 — the largest request got the fewest rows | Fixed |
| 4 | Low | Booth visitor list did not refresh after saving a lead note | Fixed |
| 5 | Info | Tenant Leads downloads every visit row to render 10 rows and 2 charts (1.3 MB at 6.5k scans, 6.4 MB at 32k) | Open — needs server-side chart aggregation |
| 6 | Info | Admin dashboard polls 4 endpoints every 5 s, ~11 MB an hour on a screen left up all day | Open — product call |
| 7 | Info | Doubled API requests in the dev server are React StrictMode; the production bundle issues each once | Not a bug |

## How to reproduce

```bash
createdb -O natcon natcon_perf
ADDR=:8084 DATABASE_URL=postgres://natcon:natcon@localhost:5432/natcon_perf?sslmode=disable \
  go run ./cmd/api            # migrates and seeds
psql "$DATABASE_URL" -f scripts/seed_event_scale.sql
cd admin && npx vitest run src/export.test.js
```

Point `admin/.env.local` at that API, open the admin app, and click each Export
button to reproduce the timings.

## Test suites at the time of writing

| Suite | Result |
|---|---|
| Admin Vitest (incl. 12 export tests) | 35 passed |
| Attendee/tenant Vitest | 9 passed |
| API end-to-end (`scripts/e2e.py`) | 169 passed |
| Concurrency (`scripts/stress.py`) | 12 passed |
| Go vet + unit tests | clean |
