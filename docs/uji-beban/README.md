# Uji beban & konkurensi

Dua berkas, satu rencana dan satu hasil:

- `skenario-uji-700-user.xlsx` — skenario yang dijalankan, lengkap dengan
  prekondisi, langkah, dan **gate kebenaran** yang wajib lulus. Ada kolom
  Result kosong dengan dropdown, untuk dipakai QA/panitia saat menjalankan
  sendiri di server produksi.
- `laporan-uji-beban-700-user.pdf` — hasil run terakhir, 7/7 lulus.

Keduanya dihasilkan dari [`scripts/load.py`](../../scripts/load.py):

```bash
createdb natcon_load
ADDR=:8099 DATABASE_URL=postgres://USER@localhost:5432/natcon_load?sslmode=disable go run ./backend/cmd/api &
ulimit -n 4096 && BASE=http://localhost:8099 N=700 python3 scripts/load.py
```

**Angka absolutnya mengikuti perangkat keras.** Yang tercatat di laporan
diukur di laptop Apple M5 dengan Postgres lokal; jalankan ulang di server
produksi sebelum hari-H untuk angka yang mewakili. Gate kebenarannya —
tidak ada kelas oversold, tidak ada scan ganda, tidak ada meja lebih dari
delapan — berlaku terlepas dari kecepatan mesin.
