# Kredensial awal

`username-password-awal-natcon2026.xlsx` — login dan password awal untuk 36
booth/sponsor dan 856 peserta, untuk sosialisasi sebelum acara. Setiap baris
sudah diuji login ke API: 892 dari 892 berhasil.

**Berkas ini ada di repositori publik atas keputusan panitia.** Yang perlu
dipahami saat membacanya:

- Password di dalamnya **bisa diturunkan** dari data yang memang sudah ada di
  repo ini — migrasi `0034` memuat chapter dan nama setiap peserta, `0033`
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
