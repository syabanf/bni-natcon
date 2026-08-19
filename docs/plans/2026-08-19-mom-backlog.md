# MoM 19 Agustus 2026 — rencana kerja

17 poin dari MoM, dipetakan ke kode yang ada. Urutannya dipilih supaya yang
menghalangi orang lain dikerjakan duluan (model waktu → sesi → validasi), dan
yang berdiri sendiri bisa jalan kapan saja.

Status: **fondasi jadwal selesai** (19 Agustus). Sisanya belum dikerjakan.

---

## Fondasi dulu: blok waktu 1 jam

Beberapa poin MoM tidak bisa dikerjakan sebelum acara punya **jadwal di
database**. Sekarang tidak ada: agenda peserta masih hard-coded di
[`frontend/src/pages/member/Home.jsx:10`](../../frontend/src/pages/member/Home.jsx),
dan keempat learning class semuanya `slot = 1` (paralel, peserta pilih satu).

Rencana: tabel `rundown` dengan blok **per 1 jam** sesuai permintaan MoM —
`starts_at`, `ends_at`, `title`, `place`, `kind` (plenary / learning / break /
networking / doorprize). Kelas dan sesi networking menunjuk ke blok itu,
bukan menyimpan jamnya sendiri.

Yang terbuka begitu ini ada:

| Poin MoM | Kenapa butuh ini |
| --- | --- |
| CRUD Rundown acara | isinya persis tabel ini |
| Maks 2 learning session, tidak bertabrakan | "bertabrakan" hanya punya arti kalau ada jam |
| Countdown networking tidak restart | sesi butuh waktu mulai & selesai yang tersimpan |

**SELESAI** — migrasi `0015_rundown.sql`, halaman **Rundown** di admin, dan
agenda peserta yang membaca dari API. Blok wajib mulai di awal jam dan
panjangnya kelipatan 1 jam; tanpa jam selesai otomatis 1 jam. Kolom
`rundown_id` sudah ada di `seminars` dan `poster_url` sudah disiapkan, tinggal
dipakai.

---

## 1. Yang berdiri sendiri (bisa dikerjakan paralel, risiko kecil)

| # | Poin MoM | Yang berubah | Perkiraan |
| --- | --- | --- | --- |
| 1 | ~~**Rename Breakout Room → Learning Class**~~ | **SELESAI** — teks di 2 app, admin, QR print, dokumen, + migrasi `0016` untuk nama ruang yang sudah tersimpan | ✓ |
| 2 | ~~**Logo perusahaan per booth**~~ | **SELESAI** — migrasi `0018`, unggah di form booth, tampil di passport; inisial tetap dipakai kalau logo kosong | ✓ |
| 3 | ~~**Redeem pin & goodiebag**~~ | **SELESAI** — bukan toggle tapi **scan**, digabung di layar penjaga pintu (revisi 19 Agt): migrasi `0017`, endpoint `/admin/redeem`, mode Attendance / Goodiebag / Pin | ✓ |
| 4 | ~~**Identifier ke-x untuk data kembar**~~ | **SELESAI** — `#2 of 3` di daftar peserta admin, `#2` di layar pilih akun saat login | ✓ |
| 5 | ~~**Penamaan antar meja**~~ | **SELESAI** — migrasi `0019`, kolom Name di admin, tampil di layar peserta | ✓ |
| 6 | ~~**Hapus input nomor meja manual**~~ | **SELESAI** — scan QR saja; kalau kamera gagal, peserta diarahkan ke panitia | ✓ |
| 7 | ~~**Join networking langsung ada save/notes**~~ | **SELESAI** — meja disegarkan tiap 5 detik selama duduk, jadi yang baru datang langsung muncul lengkap dengan tombol Save/Note | ✓ |
| 8 | ~~**Chapter & business tampil saat join**~~ | **SUDAH ADA** — chapter, perusahaan, dan klasifikasi bisnis sudah tampil di baris pertama tiap orang | ✓ |
| 9 | ~~**Simpan data meja di admin saat networking**~~ | **SELESAI** — panel "Who is seated right now" di halaman Tables + ekspor Excel | ✓ |

## 2. Butuh fondasi jadwal

| # | Poin MoM | Yang berubah | Perkiraan |
| --- | --- | --- | --- |
| 10 | **CRUD Rundown** | master data baru, blok 1 jam | 1 hari |
| 11 | **Countdown tidak restart + tombol mulai sesi** | sekarang murni di browser ([`Networking.jsx:58`](../../frontend/src/pages/member/Networking.jsx)) — pindah ke server: panitia menekan "Mulai sesi", semua peserta melihat sisa waktu yang sama, refresh tidak me-reset | 1 hari |
| 12 | **Maks 2 learning session, tidak bertabrakan** | validasi di pendaftaran: hitung sesi yang sudah diambil + tolak yang jamnya beririsan | 4 jam |

## 3. Aturan undian

| # | Poin MoM | Catatan |
| --- | --- | --- |
| 13 | **Tidak boleh menang 2 kali** | **sudah jalan** — pemenang keluar dari deck ([`LuckyDraw.jsx`](../../admin/src/LuckyDraw.jsx)), ada testnya. Tidak ada pekerjaan. |
| 14 | **Syarat kunjungan booth minimum** | setting angka minimum (mis. 10 dari 31 booth) → hanya yang memenuhi masuk deck. Ini **membalik** keputusan 18 Agustus ("semua peserta ikut"), jadi dibuat sebagai **setting**, default 0 = semua ikut. | 4 jam |
| 15 | **Doorprize ada 2** | perlu kejelasan — lihat pertanyaan terbuka | — |

## 4. Pekerjaan besar

| # | Poin MoM | Catatan | Perkiraan |
| --- | --- | --- | --- |
| 16 | **Poster portrait untuk learning class** | bertabrakan dengan perubahan 18 Agustus (cover landscape memenuhi banner) — lihat pertanyaan terbuka | 2–4 jam |
| 17 | **Door Check-in jadi aplikasi sendiri** | sekarang satu halaman di admin ([`DoorCheckin.jsx`](../../admin/src/DoorCheckin.jsx), 211 baris). Jadi aplikasi terpisah artinya: app Vite ketiga, login sendiri (role baru `door`), build & deploy sendiri, plus masuk ke docker compose dan CI | 1–2 hari |

---

## Pertanyaan terbuka

Tiga hal yang menentukan bentuk pekerjaannya, dan salah tebak berarti
membongkar ulang:

Sudah dijawab 19 Agustus:

1. **Poster** — dua gambar: banner landscape tetap di kartu daftar, poster
   portrait di halaman detail kelas. Kolom `poster_url` sudah dibuat.
2. **Doorprize** — **dua undian terpisah**, masing-masing punya daftar
   pemenang, syarat, dan tombol tariknya sendiri.
3. **Door Check-in** — **aplikasi ketiga penuh**, login sendiri (role `door`),
   masuk docker compose dan CI.

## Urutan yang disarankan

1. ~~Fondasi jadwal (blok 1 jam)~~ — **selesai**
2. Paket kecil no. 1–9 — terasa langsung, risikonya kecil
3. Countdown sesi + validasi 2 learning session
4. Aturan undian (minimum booth, doorprize)
5. Door Check-in jadi aplikasi sendiri — paling besar, paling akhir

Total kasar: **4–6 hari kerja**, di luar poin 13 yang sudah selesai.
