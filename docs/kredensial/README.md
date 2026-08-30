# Kredensial awal

**Update 29 Agu 2026 — password awal peserta sekarang `Natcon2026`.** Banyak
peserta kesulitan dengan password unik per orang, jadi atas keputusan panitia
semua peserta yang belum mengganti password (773 akun saat itu) di-reset ke
satu password bersama: `Natcon2026` — huruf besar/kecil bebas (`natcon2026`
juga diterima, seperti semua password generate-an). Kolom password peserta di
xlsx di bawah **tidak berlaku lagi**; kolom username/email tetap dipakai.
Password booth/sponsor tidak berubah. Akun yang sudah sempat membuat password
sendiri tidak disentuh. Risiko yang diterima sadar: sebelum login pertama,
siapa pun yang tahu email peserta bisa masuk lebih dulu — pemulihan lewat
Lupa Password (chapter + nomor HP) atau reset dari panel admin.

`username-password-awal-natcon2026.xlsx` — login dan password awal untuk 36
booth/sponsor dan 866 peserta, untuk sosialisasi sebelum acara. Setiap baris
sudah diuji login ke API: 902 dari 902 berhasil.

**Berkas ini ada di repositori publik atas keputusan panitia.** Yang perlu
dipahami saat membacanya:

- Password di dalamnya **bisa diturunkan** dari data yang memang sudah ada di
  repo ini — migrasi `0038` memuat chapter dan nama setiap peserta, `0037`
  memuat nama perusahaan dan kode booth, dan aturannya (chapter + nama depan;
  nama perusahaan + kode booth) tertulis di README utama. Jadi berkas ini
  menambah kemudahan, bukan paparan baru.
- **Semua password di sini hanya membuka pintu sekali.** `must_set_password`
  memaksa setiap akun memilih password sendiri pada login pertama, sebelum
  fitur apa pun terbuka.
- Kalau daftar ini perlu dibatalkan sebelum acara: jalankan ulang generator
  seed, atau reset per akun dari panel admin.

Berkas ini dibuat dari database hasil seeding resmi. **Kalau sheet peserta
atau booth berubah, berkas ini harus dibuat ulang** — nomor booth pernah
berubah dua kali, dan password booth ikut nomornya.
