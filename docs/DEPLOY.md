# Deploy

Dua bentuk deploy yang didukung. Pilih salah satu.

---

## A. Satu host, semua service (paling sederhana)

`docker compose up -d --build` di sebuah VPS. Nginx di dalam image
frontend/admin mem-proxy `/api` dan `/uploads` ke container API, jadi
semuanya satu origin dan tidak ada CORS sama sekali.

```bash
cp .env.example .env      # ganti JWT_SECRET, SEED_PASSWORD, DB_PASSWORD
docker compose up -d --build
```

| Service  | Port host (default) |
| -------- | ------------------- |
| Frontend | 8088                |
| Admin    | 8089                |
| API      | 8090                |
| Postgres | 5432                |

---

## B. Frontend di Vercel, API terpisah (split deploy)

Vercel hanya menyajikan hasil `vite build` — file statis. **Tidak ada
backend Go di sana**, jadi `POST /api/v1/auth/login` ke domain Vercel
selalu `404 NOT_FOUND` (`X-Vercel-Error: NOT_FOUND`). API-nya harus
di-host sendiri, lalu URL-nya di-bake ke dalam build frontend.

### 1. Deploy API + Postgres

API adalah container tunggal (`backend/Dockerfile`, stateless kecuali
folder upload) plus satu Postgres. Host mana pun yang bisa menjalankan
Docker bisa dipakai — Railway, Render, Fly.io, atau VPS biasa.

Environment yang wajib diisi:

| Variabel          | Nilai                                                      |
| ----------------- | ---------------------------------------------------------- |
| `APP_ENV`         | `production`                                                |
| `JWT_SECRET`      | hasil `openssl rand -hex 32` — API menolak start dengan default |
| `DATABASE_URL`    | connection string Postgres milik host                       |
| `ADDR`            | `:8080`, atau `:$PORT` bila host menentukan port sendiri     |
| `ALLOWED_ORIGINS` | domain Vercel, dipisah koma — lihat langkah 3                |
| `UPLOAD_DIR`      | path di **persistent volume**, mis. `/data/uploads`          |
| `SEED_PASSWORD`   | password akun demo hasil seeding                             |

Migrasi dan seeder jalan otomatis saat start; tidak ada langkah manual.
Master data acara ikut di dalamnya — 31 booth asli (migrasi `0014`, lengkap
dengan login scanner, kontak booth, dan chapter), 2 sponsor BNI, serta 4
breakout class beserta narasumbernya. Jadi database baru maupun yang sudah
jalan sama-sama berakhir dengan data yang sama; peserta tetap lewat import
Excel.

> **Cover seminar**: file upload disimpan di disk. Tanpa persistent
> volume, gambar hilang setiap redeploy. Arahkan `UPLOAD_DIR` ke volume,
> atau jangan pakai fitur upload cover.

Cek berhasil:

```bash
curl https://api-anda.example.com/healthz
```

### 2. Set `VITE_API_URL` di Vercel

Di project Vercel → Settings → Environment Variables:

```
VITE_API_URL = https://api-anda.example.com
```

(tanpa trailing slash, tanpa `/api/v1` — itu ditambahkan sendiri)

Nilainya **di-bake saat build**, jadi setelah mengubahnya harus
**Redeploy**; mengubah env saja tidak mengubah build yang sudah jadi.

Kalau app peserta dan admin di-deploy sebagai dua project Vercel, isi
variabel ini di **kedua-duanya**, plus `VITE_ADMIN_URL` di project
peserta agar link "Committee? Open the admin panel" mengarah ke domain
admin.

Root Directory tiap project: `frontend` dan `admin`. `vercel.json` di
masing-masing folder sudah mengatur build command, output `dist`, dan
SPA fallback (deep link seperti `/attendee/qr` tidak 404). Rewrite-nya
sengaja mengecualikan `/api/` dan `/uploads/` supaya `VITE_API_URL` yang
belum di-set tetap gagal sebagai 404 yang kelihatan, bukan diam-diam
mengembalikan `index.html` dan berubah jadi error parsing JSON.

### 3. Daftarkan domain Vercel di `ALLOWED_ORIGINS`

Browser akan mengirim request cross-origin, jadi API harus
mengizinkannya. Isi dengan **origin** (skema + host, tanpa path):

```
ALLOWED_ORIGINS=https://bni-natcon.vercel.app,https://bni-natcon-admin.vercel.app
```

Restart API setelah mengubahnya. Kalau kelewat, login gagal dengan error
CORS di console browser — bukan 404.

### Checklist saat login masih gagal

| Gejala di Network tab                              | Penyebab                                              |
| -------------------------------------------------- | ----------------------------------------------------- |
| `404` ke `https://<domain-vercel>/api/v1/auth/login` | `VITE_API_URL` belum di-set / belum redeploy           |
| `404` ke domain API                                 | URL API salah, atau service-nya tidak jalan            |
| Request diblokir CORS                               | domain Vercel belum ada di `ALLOWED_ORIGINS`           |
| `500` + log `JWT_SECRET`                            | `APP_ENV=production` tapi `JWT_SECRET` masih default   |
| `401 invalid credentials`                           | akun/password memang salah — API-nya sendiri sudah oke |

Selama API belum siap, tombol **"API mode — tap to try Demo (Mock) mode"**
di halaman login menjalankan seluruh app dengan data lokal di browser.
