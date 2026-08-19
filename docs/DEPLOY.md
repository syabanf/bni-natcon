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
| Door     | 8087                |
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
| `SEED_PASSWORD`   | password akun admin (dan akun booth yang dibuat nanti)        |

Migrasi dan seeder jalan otomatis saat start; tidak ada langkah manual.
Database baru berisi akun `admin@natcon.id`, **4 learning class beserta
narasumbernya**, dan **31 booth dari sheet *Data Booth*** (migrasi `0014`,
lengkap dengan login scanner `booth-<kode>@natcon.id`). Tidak ada peserta
demo, chapter, atau meja networking bawaan: peserta & chapter masuk lewat
import export ticketing, meja dibuat di halaman Tables.

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

Di project admin, isi juga `VITE_PUBLIC_APP_URL` dengan domain app peserta
(mis. `https://bninatcon.com`). Itu yang dipakai halaman **QR Prints →
Sign-in Doors** untuk membuat QR pintu login yang dicetak; kalau salah,
QR-nya mengarah ke domain yang salah.

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
ALLOWED_ORIGINS=https://bni-natcon.vercel.app,https://bni-natcon-admin.vercel.app,https://localhost
```

`https://localhost` itu **APK Android**-nya: isi APK berjalan sebagai halaman
di origin tersebut. Kalau tidak didaftarkan, app web jalan normal tapi semua
request dari APK kena CORS. Lihat [`ANDROID.md`](ANDROID.md).

Restart API setelah mengubahnya. Kalau kelewat, login gagal dengan error
CORS di console browser — bukan 404.

### Deploy ulang (docker compose di VPS)

```bash
cd /path/ke/BNI-Digital-Stamp
git pull
docker compose build api frontend admin
docker compose up -d
docker compose logs -f api --tail=30
```

Yang dicari di log: baris `INFO image uploads ready dir=/data/uploads`.
Kalau yang muncul `ERROR UPLOAD_DIR is not usable`, lihat bagian di bawah.

Volume `natcon-uploads` dan `natcon-db` **tidak** tersentuh oleh perintah di
atas — jangan pakai `docker compose down -v`, itu menghapus cover yang sudah
di-upload dan seluruh database.

### Upload gambar gagal 500 — folder simpan tidak bisa ditulis

Gambar disimpan ke disk di path `UPLOAD_DIR`. Kalau API tidak punya izin tulis
di sana, upload menjawab **500**. Sejak sekarang pesannya menyebut path-nya:

```
the server cannot write to its image folder (/data/uploads) — the volume is
not writable by the API. Fix the permissions on that path, or point
UPLOAD_DIR somewhere writable.
```

Dan saat start API mencetak salah satu dari dua baris ini, jadi salah setting
ketahuan waktu deploy, bukan waktu panitia memasang cover:

```
INFO  image uploads ready dir=/data/uploads
ERROR UPLOAD_DIR is not usable — image uploads will fail dir=... err=...
```

**Penyebab paling sering (dan sudah diperbaiki di image):** container API
berjalan sebagai user `app` (uid 10001), sementara Docker membuat volume
baru dengan pemilik `root`. Akibatnya API tidak bisa menulis ke
`/data/uploads`. Sejak `backend/Dockerfile` membuat folder itu di dalam image
dan meng-`chown`-nya ke `app`, volume **baru** ikut mewarisi kepemilikan itu.

**Volume yang terlanjur dibuat sebelum perbaikan tetap milik root** — Docker
hanya menyalin kepemilikan saat volume masih kosong. Betulkan sekali saja:

```bash
docker compose run --rm --user root --entrypoint sh api \
  -c 'chown -R 10001:10001 /data/uploads && ls -ld /data/uploads'
docker compose restart api
docker compose logs api --tail=5      # harus: image uploads ready
```

Di host non-docker: pastikan user yang menjalankan API punya izin tulis di
`UPLOAD_DIR`, dan path-nya persisten — kalau tidak, semua cover hilang tiap
redeploy.

### Upload gambar gagal / 502 saat pilih foto

Cover learning class dan foto narasumber diambil dari HP, jadi ukurannya
megabyte. Batasnya **5 MB per gambar** di API — tapi yang biasanya memutus
duluan adalah proxy di depannya:

| Bentuk deploy | Yang harus diset |
| ------------- | ---------------- |
| Docker compose | sudah beres: `client_max_body_size 6m` ada di `frontend/nginx.conf` dan `admin/nginx.conf` |
| API di host lain (Railway/Render/VPS + nginx sendiri) | naikkan batas body proxy-nya ke **6 MB**; default nginx cuma 1 MB |

Gejalanya khas: proxy berhenti membaca body di tengah jalan, lalu browser
menerima **502** — bukan 413 — sehingga kelihatan seperti server mati padahal
API-nya sehat.

Sejak panel admin **mengecilkan gambar di browser sebelum dikirim** (maksimum
sisi panjang 1600 px, JPEG kualitas 0.82), foto HP 4–10 MB berangkat sebagai
~300–500 KB, jadi batas ini jarang tersentuh. Yang tetap perlu diset adalah
proxy-nya, untuk file yang tidak bisa didekode browser (mis. HEIC di Chrome)
dan tetap dikirim apa adanya.

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
