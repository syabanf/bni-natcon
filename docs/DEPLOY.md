# Deploy

Dua bentuk deploy yang didukung. Pilih salah satu.

---

## A. Satu host, semua service (paling sederhana)

`docker compose up -d --build` di sebuah VPS. Nginx di dalam image
frontend/admin mem-proxy `/api` dan `/uploads` ke load balancer, jadi
semuanya satu origin dan tidak ada CORS sama sekali.

### Bentuk stack-nya

```
peserta / panitia
        │
        ▼
   lb (nginx)  ← satu-satunya pintu ke API, port ${API_PORT:-8090}
        │  round-robin, re-resolve tiap 10 detik
        ├──► api  ┐
        ├──► api  ├─ ${API_REPLICAS:-2} container, tanpa port host sendiri
        └──► ...  ┘
                  └──► db (Postgres)  + volume upload bersama
```

**Replika tidak membuat mesin jadi lebih cepat.** Satu proses Go sudah
memakai semua core; diukur di host 4 CPU, 3 replika justru **lebih lambat**
daripada 1 (browse 691 rps vs 1271 rps) karena CPU yang sama dibagi tiga
plus satu lompatan nginx. Yang dibeli replika adalah **ketahanan**: satu
container mati di tengah acara tidak menjatuhkan hari itu. Diuji dengan
mematikan satu replika saat trafik berjalan — 120 dari 120 request tetap
200. Naikkan `API_REPLICAS` hanya kalau CPU-nya memang ditambah.

### Aritmetika koneksi database

Setiap replika punya pool sendiri, jadi anggarannya:

```
API_REPLICAS × DB_MAX_CONNS  <  max_connections Postgres
        2     ×      10      =  20   (default, dari 200)
```

Kehabisan koneksi terlihat sebagai API gagal start — pada saat paling tidak
diinginkan. Kalau menaikkan `API_REPLICAS`, periksa perkalian ini dulu.

### Kalau API di-scale ke beberapa host

Dua syarat yang di satu host sudah otomatis terpenuhi:

1. **Folder upload harus dibagi.** Di compose ini semua replika memakai satu
   named volume. Lintas host, `/data/uploads` perlu object storage atau NFS,
   kalau tidak logo yang diunggah panitia hanya ada di satu instance.
2. **Migrasi sudah aman.** Instance yang start bersamaan berebut satu
   advisory lock Postgres; satu mengerjakan migrasi + seeding, sisanya
   menunggu lalu melewatinya. Tanpa itu, tiga instance akan menyemai acara
   yang sama tiga kali.

```bash
cp .env.example .env      # ganti JWT_SECRET, SEED_PASSWORD, DB_PASSWORD
docker compose up -d --build
```

| Service  | Port host (default) |
| -------- | ------------------- |
| Frontend | 8088                |
| Admin    | 8089                |
| Door     | 8087 (di `/door`, login `/door/login`) |
| API (lewat `lb`) | 8090        |
| Postgres | 5432                |

Container `api` sendiri **tidak punya port host** — hanya `lb` yang
mengeksposnya, supaya jumlah replika bisa diubah tanpa bentrok port.

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
| `DB_MAX_CONNS`    | ukuran pool Postgres (default 25). Turunkan kalau database punya kuota koneksi kecil |
| `DB_MIN_CONNS`    | koneksi yang dijaga tetap hangat (default 5), supaya burst pagi tidak antre buka koneksi |
| `DATABASE_URL`    | connection string Postgres milik host                       |
| `ADDR`            | `:8080`, atau `:$PORT` bila host menentukan port sendiri     |
| `ALLOWED_ORIGINS` | domain Vercel, dipisah koma — lihat langkah 3                |
| `UPLOAD_DIR`      | path di **persistent volume**, mis. `/data/uploads`          |
| `SEED_PASSWORD`   | password akun admin (dan akun booth yang dibuat nanti)        |

Migrasi dan seeder jalan otomatis saat start; tidak ada langkah manual.
Database baru berisi akun `admin@natcon.id`, **4 learning class beserta
narasumbernya**, **32 booth + 4 sponsor dari sheet booth** (migrasi `0037`,
lengkap dengan login scanner `booth-<kode>@natcon.id`), dan **rundown resmi 3
September** (migrasi `0048`, sesuai PDF run of show panitia: 16 blok, registrasi
07.00 sampai Closing 18.30) —
rapikan di halaman Rundown; blok yang dihapus tidak muncul lagi saat restart.
Keempat kelas sudah ditempatkan ke dua blok Learning Session, yang membuat
aturan "dua kelas asal jamnya tidak bentrok" benar-benar berlaku.

> **Setelah deploy migrasi `0037`**: denah mengikuti sheet terbaru panitia —
> GrasiaCare kembali memegang dua stand (`A18 & A20`), dan **11 booth pindah
> nomor**, mulai dari Paper.id yang kini di **A22**. Exhibitor dikenali lewat
> nama perusahaan, jadi yang pindah tetap membawa login dan seluruh scan-nya.
>
> Dua hal yang **harus** dikerjakan panitia setelah deploy:
> 1. **Cetak ulang QR booth** dari halaman QR Prints — nomor stand berubah.
> 2. **Bagikan ulang login booth.** Alamatnya mengikuti stand: Paper.id kini
>    `booth-a22@natcon.id`. Password awalnya `SEED_PASSWORD`, sama untuk semua
>    akun. Kru yang sudah membuat password sendiri tidak diusik.

**Peserta** ikut sebagai migrasi `0038`: 866 orang dari export ticketing,
satu akun per tiket, password awal `SEED_PASSWORD` (sama untuk semua) dan
wajib diganti saat login pertama. Kalau panitia mengirim export baru, buat ulang dengan
`python3 scripts/attendees_migration.py "Data Peserta ....xlsx"`. Catatan:
file itu berisi nama, email, dan nomor HP 866 orang dan repo ini publik. Tidak ada peserta
demo, chapter, atau meja networking bawaan: peserta & chapter masuk lewat
import export ticketing. **Meja networking ikut ter-seed** (migrasi `0051`):
90 meja berkapasitas 10, persis kartu QR yang sudah dicetak — meja tambahan
tetap bisa dibuat di halaman Tables.

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

Mode demo sudah tidak ada: aplikasi hanya bicara ke API, supaya tidak ada
data karangan yang bisa muncul di layar siapa pun saat acara.
