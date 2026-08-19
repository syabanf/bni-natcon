# MoM 19 Agustus 2026 — rencana kerja

17 poin dari MoM, dipetakan ke kode yang ada. Urutannya dipilih supaya yang
menghalangi orang lain dikerjakan duluan (model waktu → sesi → validasi), dan
yang berdiri sendiri bisa jalan kapan saja.

Status: **belum ada satupun yang dikerjakan** — dokumen ini rencananya.

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

**Perkiraan: 1 hari** (migrasi + CRUD admin + agenda peserta baca dari DB).

---

## 1. Yang berdiri sendiri (bisa dikerjakan paralel, risiko kecil)

| # | Poin MoM | Yang berubah | Perkiraan |
| --- | --- | --- | --- |
| 1 | **Rename Breakout Room → Learning Class** | teks di 2 app + admin + QR print + dokumen; nama tabel `seminars` dibiarkan (rename tabel tidak sebanding risikonya) | 2 jam |
| 2 | **Logo perusahaan per booth** | kolom `logo_url` di `tenants`, upload di admin (jalur upload yang sudah diperbaiki), dipakai menggantikan inisial di passport peserta | 3 jam |
| 3 | **Redeem pin & goodiebag true/false** | 2 kolom boolean di `users` + toggle di admin + tampil di detail peserta | 3 jam |
| 4 | **Identifier ke-x untuk data kembar** | urutan per grup (nama+email+telepon sama) → tampil `#2` di list, detail, dan layar pilih akun | 3 jam |
| 5 | **Penamaan antar meja** | kolom `name` di `networking_tables`, dipakai di admin, QR print, dan tampilan peserta | 2 jam |
| 6 | **Hapus input nomor meja manual** | buang form ketik di [`Networking.jsx`](../../frontend/src/pages/member/Networking.jsx) — scan QR saja | 1 jam |
| 7 | **Join networking langsung ada save/notes** | tombol simpan kontak + catatan muncul begitu masuk meja, tanpa buka detail | 2 jam |
| 8 | **Chapter & business tampil saat join** | sudah ada di data; tinggal naikkan ke tampilan pertama | 1 jam |
| 9 | **Simpan data meja di admin saat networking** | halaman admin menampilkan isi tiap meja (siapa duduk di mana) + ekspor | 3 jam |

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

1. **Poster portrait vs banner landscape.** Kemarin banner dibuat landscape
   penuh. Portrait di kartu daftar akan makan tinggi layar peserta.
2. **"Doorprize ada 2"** — dua undian terpisah, atau dua pemenang sekali tarik?
3. **Door Check-in sebagai aplikasi sendiri** — aplikasi ketiga dengan login
   sendiri, atau cukup halaman terpisah dengan akun khusus?

## Urutan yang disarankan

1. Fondasi jadwal (blok 1 jam) — membuka 3 poin sekaligus
2. Paket kecil no. 1–9 — terasa langsung, risikonya kecil
3. Countdown sesi + validasi 2 learning session
4. Aturan undian (minimum booth, doorprize)
5. Door Check-in jadi aplikasi sendiri — paling besar, paling akhir

Total kasar: **4–6 hari kerja**, di luar poin 13 yang sudah selesai.
