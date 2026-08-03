# BNI Natcon 2026 — Digital Stamp App · Ringkasan Proyek

> Satu dokumen yang merangkum seluruh proyek: konsep, arsitektur, fitur,
> API, pengujian, hardening, dan cara deploy.
>
> Repo: <https://github.com/syabanf/bni-natcon> · CI: GitHub Actions (hijau)
> · Desain awal: [2026-07-24-natcon-digital-stamp-design.md](plans/2026-07-24-natcon-digital-stamp-design.md)

---

> **Revisi MoM (30 Jul 2026):** seluruh UI berbahasa **Inggris**; kupon
> door prize → **claim Pin**; seminar dipilih → **claim totebag** saat
> check-in pintu (QR seminar **terpisah** + detail & cover seminar);
> passport ber-kategori **Sponsor (atas) & Booth** dengan deskripsi tenant
> dan yang sudah discan turun ke bawah; networking **scan meja dulu**
> + notes per orang + kontak email/telepon (tap → buka app); booth scanner
> menerima **ID / nomor HP**, notes per pengunjung + detail pengunjung;
> role **sponsor**; halaman **Lucky Draw** dengan animasi shuffle kartu
> berbobot pin; quick login Reddie di landing.

## 1. Konsep

Aplikasi event untuk **BNI Natcon 2026** (National Conference · Business
Network International Indonesia), dibangun dari mockup statis
`natcon2026-mockup_3.html`. Ide intinya: mengganti stempel kertas dengan
**stempel digital** —

- **Peserta** memegang satu QR (member pass) untuk semua kebutuhan.
- **Tenant** men-scan QR peserta di booth → tercatat sebagai kunjungan =
  **1 kupon door prize**. Duplikat terdeteksi otomatis.
- **Seminar paralel**: peserta memilih satu sesi per slot (kapasitas
  dijaga transaksional), bisa batal dan pindah sesi.
- **Speed networking**: check-in di meja (8 kursi), semua yang semeja
  otomatis saling terhubung dan bisa saling menyimpan kontak.
- **Panitia (admin)** memantau semuanya live, mengelola master data, dan
  menarik laporan.

## 2. Arsitektur & Struktur Repo

Tiga aplikasi terpisah, satu monorepo:

```
├── backend/    Go 1.26 — clean architecture, chi + pgx + JWT, PostgreSQL
│   ├── cmd/api/main.go              composition root + graceful shutdown
│   └── internal/
│       ├── domain/                  entitas, error, interface repo (tanpa dependensi)
│       ├── usecase/                 aturan bisnis (unit-tested dengan fake)
│       ├── repository/postgres/     implementasi pgx + migrasi embed + seeder
│       └── delivery/http/           router chi, handler, middleware JWT/role
├── frontend/   React 18 + Vite (JS) — app Peserta & Tenant (:5173)
├── admin/      React 18 + Vite (JS) — Admin Panel (:5174)
├── scripts/e2e.py                   suite end-to-end 102 check (stdlib only)
├── scripts/stress.py                suite stress & concurrency (stdlib only)
├── docker-compose.yml               full stack: db + api + frontend + admin
└── .github/workflows/ci.yml         CI: vet/test, e2e, build FE, build docker
```

**Aturan dependensi** (clean architecture): `domain` tidak bergantung pada
apa pun; `usecase` hanya pada `domain`; `repository` dan `delivery`
mengarah ke dalam; `cmd/api` merakit semuanya.

**Tema UI**: mengikuti mockup asli — font Plus Jakarta Sans, kartu rounded
dengan shadow lembut, pill berwarna tint, palet merah `#CF2030`. (Sempat
dieksplorasi tema Swiss/International Typographic Style, lalu dikembalikan
ke tema mockup atas permintaan.)

## 3. Aplikasi & Fitur

### 3.1 App Peserta/Tenant (`frontend/`, :5173)

Landing = **quick access**: pilih Aplikasi Peserta / Aplikasi Tenant /
Admin Dashboard, dengan **quick login** satu-tap untuk akun demo dan
**toggle Mode Demo (Mock)**.

| Screen | Fitur |
|---|---|
| Beranda | Member pass dengan **QR asli** (qrcode.react), statistik live, menu cepat, agenda |
| QR Saya | QR besar siap di-scan + penjelasan kegunaan |
| Passport | Progres kunjungan 12 tenant, kupon door prize, grid stempel digital |
| Seminar | Daftar sesi paralel, kunci satu-per-slot, **batal & pindah sesi**, sisa kursi live |
| Network | **Speed networking**: pilih/scan meja, visual meja bundar 8 kursi, simpan kontak satu/semua, pindah meja, **riwayat** (log meja + kontak tersimpan) dengan **halaman detail** per meja & per kontak |
| Scanner (tenant) | Scan kamera (html5-qrcode, **lazy-loaded** ke chunk terpisah) + input manual fallback, hasil ok/duplikat/error; **antrean offline** — scan saat putus jaringan disimpan di localStorage dan disinkronkan otomatis saat online |
| Dashboard (tenant) | Statistik booth + daftar pengunjung, polling 5 detik |

App peserta/tenant juga terpasang sebagai **PWA** (manifest + service worker
di build produksi): shell aplikasi di-cache sehingga tetap terbuka tanpa
jaringan.

### 3.2 Admin Panel (`admin/`, :5174)

Sidebar: Dashboard · Peserta · Tenant · Seminar · **Check-in Pintu** ·
**Laporan** (3 halaman).

- **Dashboard live**: 6 kartu statistik, peringkat booth, keterisian
  seminar, feed aktivitas — polling 5 detik.
- **Check-in Pintu** (kehadiran seminar beneran): panitia pintu memilih
  ruang, lalu scan QR peserta (kamera, lazy-loaded) atau input manual —
  hadir vs terdaftar + % kehadiran tampil live, duplikat ditandai tanpa
  dihitung dua kali, peserta yang tidak terdaftar di sesi itu ditolak.
  Kehadiran mengalir ke halaman detail seminar (kolom Hadir) dan laporan
  Registrasi Seminar (termasuk export Excel).
- **Master data (CRUD via modal popup)** untuk Peserta / Tenant / Seminar:
  - List peserta ber-**pagination** (25/halaman) dengan **kotak cari**
    (nama/email/member code/chapter) — query dieksekusi di server
    (`?q=&page=&limit=`).
  - Member code & password default dibuat otomatis; akun scanner booth
    (`booth-xxx@natcon.id`) dibuat otomatis saat tambah tenant.
  - **Import Excel** (SheetJS, header fleksibel Indonesia/Inggris) dengan
    laporan sukses/gagal per baris.
  - Tombol **Detail** per baris → halaman detail (profil + riwayat
    kunjungan/leads/daftar hadir).
  - Hapus ber-cascade (scan/registrasi/akun booth ikut terhapus).
- **Laporan** per halaman, masing-masing dengan **grafik** (bar chart flat
  ber-tooltip) dan **Export Excel**:
  1. *Leads Tenant* — scan per booth, scan per jam, rincian kunjungan.
  2. *Registrasi Seminar* — keterisian kursi, daftar hadir per ruang.
  3. *Kupon Peserta* — distribusi kupon, top kolektor, tabel semua peserta.

### 3.3 Mode Demo (Mock) — kedua aplikasi

Toggle di halaman login (bukan env). Saat aktif, seluruh aplikasi berjalan
dari **localStorage tanpa backend** dengan bentuk respons yang identik:

- *Peserta/Tenant*: state nyambung antar-persona di perangkat yang sama
  (scan booth sebagai tenant → muncul di passport peserta), meja
  networking berpenghuni persona demo.
- *Admin*: data seed (8 peserta, 12 booth, scan tersebar antar jam agar
  grafik hidup) + CRUD/import/laporan/detail berfungsi penuh; password
  bebas.
- Chip **DEMO** menandai mode aktif di kedua app.

## 4. Model Data (PostgreSQL, migrasi embed otomatis)

| Tabel | Inti |
|---|---|
| `users` | role `member` / `tenant` / `admin`, bcrypt, `member_code` unik, `phone` |
| `chapters` | master data chapter — diisi otomatis dari import/CRUD member; rename ber-cascade ke member |
| `tenants` | booth + `owner_user_id` (akun scanner) |
| `visits` | **stempel digital** — unik (tenant, member); kupon = jumlah visit |
| `seminars`, `seminar_registrations` | unik (seminar, member); satu-per-slot + kapasitas dijaga transaksi `FOR UPDATE` |
| `seminar_attendance` | check-in pintu — unik (seminar, member), duplikat aman via `ON CONFLICT DO NOTHING` |
| `networking_tables`, `networking_checkins` | 12 meja × 8 kursi; satu check-in aktif per member (pindah = lepas kursi lama) |
| `networking_contacts`, `networking_table_history` | kontak tersimpan + log riwayat check-in |

Seeder otomatis saat DB kosong: 3 peserta, 12 tenant + akun booth,
2 seminar, 1 admin. Semua akun demo ber-password `natcon2026`.

## 5. API Ringkas (`/api/v1`, JWT Bearer)

| Area | Endpoint |
|---|---|
| Auth | `POST /auth/login` (rate-limited), `GET /me` |
| Member | `GET /tenants` · `GET /seminars` · `POST/DELETE /seminars/{id}/register` |
| Networking | `GET /networking` · `POST /networking/checkin` · `POST /networking/contacts(/all)` · `GET /networking/history` · `GET /networking/tables/{no}` · `GET /networking/contacts/{id}` |
| Tenant | `POST /scans` · `GET /booth(/stats,/visitors)` |
| Admin monitor | `GET /admin/overview` · `/admin/tenants` · `/admin/seminars` · `/admin/activity` |
| Admin CRUD | `GET/POST/PUT/DELETE /admin/{members,tenants,seminars}(/{id})` + `GET .../{id}` detail; list peserta menerima `?q=&page=&limit=` |
| Admin check-in | `POST /admin/seminars/{id}/checkin` — body `member_code`; 409 bila belum terdaftar, duplikat ditandai |
| Admin import/laporan | `POST /admin/{members,tenants}/bulk` · `GET /admin/report/{visits,registrations}` (registrasi kini ber-flag `attended`) |
| Observability | `GET /metrics` — Prometheus (jumlah request per method/kode + histogram latensi) |

Konvensi error: 401 kredensial/token, 403 salah role, 404 tidak ada,
409 konflik (duplikat email, seminar penuh/sudah terdaftar, meja penuh),
400 input tidak valid. Scan duplikat **bukan** error (200 + `duplicate: true`).

## 6. Pengujian

- **Unit test** (`go test ./...`): table-driven di layer usecase dengan
  fake repo — login, scan/duplikat, statistik, aturan slot/kapasitas
  seminar, batal-dan-pindah.
- **E2E** (`scripts/e2e.py`, Python stdlib, **102 check**): dijalankan
  terhadap API live + DB segar — auth & guard semua role, alur scan,
  seminar penuh, check-in pintu (tercatat/duplikat/ditolak), seluruh alur
  networking, admin CRUD/detail/bulk/laporan, pagination & search,
  `/metrics`, dan probe hardening (body 3 MB ditolak, rate limit 429).
  Hasil terakhir: **102 passed, 0 failed** (lokal dan di CI).
- **Stress & concurrency** (`scripts/stress.py`): beban baca 10k request
  (~10.000 req/s, p99 45 ms), 100 peserta rebutan 10 kursi seminar →
  tepat 10 sukses, 100 rebutan meja 8 kursi → tepat 8, 100 scan serentak
  → tepat 1 dihitung.
- **Test frontend** (Vitest, `npm test` di `frontend/` dan `admin/`):
  menguji lapisan mock kedua app — persona login, scan/kupon lintas
  persona, aturan slot seminar, alur networking, check-in pintu, CRUD +
  pagination admin.

## 7. Hardening

- `http.Server` dengan timeout (read/write/idle/header) + **graceful
  shutdown** SIGINT/SIGTERM; timeout 30 s per request.
- Batas body **2 MiB**; security headers (`nosniff`, `X-Frame-Options:
  DENY`, `Referrer-Policy`, `Cache-Control: no-store`).
- **Rate limit login** 10 percobaan/IP/menit.
- CORS via env `ALLOWED_ORIGINS`; menolak start di `APP_ENV=production`
  dengan `JWT_SECRET` default; validasi format email di jalur admin.

## 8. Menjalankan & Deploy

**Dev lokal**: `docker compose up -d db` (atau Postgres lain) →
`go run ./backend/cmd/api` → `npm run dev` di `frontend/` dan `admin/`.
Override port API via `VITE_API_PROXY` di `.env.local` masing-masing app.

**Konfigurasi env**: template variabel predefined tersedia —
`.env.example` (root, dipakai docker compose **dan** di-auto-load API Go;
env asli selalu menang), `frontend/.env.example`, `admin/.env.example`.
Salin ke `.env` / `.env.local` lalu sesuaikan; semua variabel punya
default development yang aman. Compose sepenuhnya terparameterisasi
(kredensial DB, port host tiap service, `JWT_SECRET`, `APP_ENV`,
`ALLOWED_ORIGINS`, `VITE_ADMIN_URL`).

**Deploy sekali perintah**:

```bash
docker compose up -d --build
```

→ Postgres + API (:8090) + app peserta (**:8088**) + admin (**:8089**);
nginx di tiap image frontend menyajikan build statis dan mem-proxy `/api`
ke container API (tanpa urusan CORS). Set `JWT_SECRET` +
`APP_ENV=production` untuk produksi.

**CI (GitHub Actions)** di tiap push/PR: `go vet` + unit test → E2E 102
check + suite stress vs container Postgres → Vitest + build produksi kedua
frontend → `docker compose build`.

## 9. Akun Demo

| Role | Email | Catatan |
|---|---|---|
| Peserta | `reddie@natcon.id` / `sinta@natcon.id` / `agus@natcon.id` | kode `NATCON-2026-xxxxx` |
| Tenant | `booth-a03@natcon.id` (dst. per booth) | scanner booth |
| Admin | `admin@natcon.id` | panel panitia |

Password semua: `natcon2026` (mode mock: password bebas).

## 10. Belum Dikerjakan / Ide Lanjutan

QR ber-tanda-tangan (anti-pemalsuan), WebSocket untuk dashboard (kini
polling), rate-limit endpoint non-login, ronde networking multi-sesi,
dan ekspor PDF laporan.
