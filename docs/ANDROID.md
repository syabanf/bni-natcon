# APK peserta & booth

Satu APK untuk dua audiens. Aplikasi di dalamnya persis aplikasi web
`frontend/` — peserta login di pintu peserta, kru booth di pintu booth, dan
role akun yang menentukan halaman mana yang terbuka. Panel admin **tidak**
ikut: itu aplikasi terpisah (`admin/`) yang dipakai panitia dari laptop.

Dibungkus dengan [Capacitor](https://capacitorjs.com) — aset web-nya
dimasukkan ke dalam APK, jadi app tetap terbuka meski sinyal jelek; yang
lewat jaringan hanya panggilan API.

---

## Bikin APK-nya

```bash
VITE_API_URL=https://api-anda.example.com scripts/build-apk.sh
```

Hasilnya di `dist/natcon2026-debug.apk`, siap dikirim/di-upload untuk
di-download langsung.

**`VITE_API_URL` wajib.** APK membawa aset app di dalam dirinya sendiri dan
tidak punya dev-proxy seperti waktu `npm run dev`. Kalau alamat API tidak
di-bake saat build, APK-nya tetap jadi, tetap ter-install, lalu **gagal di
setiap login** — itu sebabnya script menolak jalan tanpa variabel ini.
Ganti API? Build ulang APK-nya.

Yang dibutuhkan mesin build:

| Alat        | Versi | Catatan                                        |
| ----------- | ----- | ---------------------------------------------- |
| Node        | 24    | sama seperti CI                                 |
| JDK         | **21** | Capacitor 7 menolak JDK 17 (`invalid source release: 21`) |
| Android SDK | platform 35 + build-tools | `ANDROID_HOME` harus terisi |

Di macOS: `brew install openjdk@21`, lalu

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
```

## Pasang di HP

```bash
adb install -r dist/natcon2026-debug.apk
```

Tanpa kabel: kirim file APK-nya (WhatsApp/Drive/link), lalu di HP izinkan
**"Install unknown apps"** untuk aplikasi tempat file itu dibuka. Ini normal
untuk APK di luar Play Store.

## Build release (ditandatangani sendiri)

Debug APK bisa dipasang siapa pun, tapi ditandatangani kunci debug. Untuk
distribusi resmi, buat keystore sekali saja lalu simpan di luar repo:

```bash
keytool -genkeypair -v -keystore ~/natcon.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias natcon
```

```bash
NATCON_KEYSTORE=~/natcon.jks \
NATCON_KEYSTORE_PASSWORD=… \
NATCON_KEY_ALIAS=natcon \
VITE_API_URL=https://api-anda.example.com \
scripts/build-apk.sh
```

Hasilnya `dist/natcon2026-release.apk`.

> Keystore dan password-nya **tidak boleh** masuk repo. `.gitignore` sudah
> memblokir `*.jks`/`*.keystore`, dan password hanya lewat environment.
> Kehilangan keystore = tidak bisa lagi merilis update yang dianggap
> aplikasi yang sama oleh Android.

## Yang sudah diatur di dalam APK

- **Nama & ikon**: "Natcon 2026", ikon BNI (legacy + adaptive), splash
  memakai lockup *Accelerate* di atas putih.
- **Izin kamera**: scan QR di booth dan di meja networking. Kamera
  dideklarasikan opsional, jadi tablet tanpa kamera tetap bisa install dan
  memakai input manual.
- **Portrait**: app-nya satu kolom; landscape tidak pernah dipakai.
- **Service worker dimatikan di native.** Di web ia yang bikin app bisa
  offline; di dalam APK aset sudah ada di APK, dan cache SW yang basi justru
  bisa menyajikan versi lama setelah user meng-install APK baru.

## API-nya harus HTTPS

Isi APK dijalankan sebagai halaman di origin `https://localhost` (skema
Android bawaan Capacitor). Artinya panggilan ke API `http://…` diblokir
WebView sebagai **mixed content** — bukan cuma soal cleartext Android.
Diuji langsung: dengan `allowMixedContent: false`, login ke API HTTP gagal
dengan *"Cannot reach the server"* dan **tidak ada satu pun request yang
sampai ke server**.

Dua konsekuensi:

1. **API acara wajib HTTPS.** Tidak ada jalan pintas di sisi app.
2. **`https://localhost` wajib ada di `ALLOWED_ORIGINS`** API-nya, kalau
   tidak semua request dari APK kena CORS. Sudah masuk default
   `backend/internal/config/config.go`; kalau di produksi variabel itu
   di-set manual, jangan sampai terlupa:

   ```
   ALLOWED_ORIGINS=https://natcon.example.com,https://localhost
   ```

Untuk uji coba ke API di laptop (`http://10.0.2.2:8081` dari emulator, atau
`http://<ip-laptop>:8081` dari HP), ubah `allowMixedContent` jadi `true` di
`frontend/capacitor.config.json`, dan untuk IP LAN tambahkan juga
alamatnya ke `frontend/android/app/src/main/res/xml/network_security_config.xml`.
**Kembalikan sebelum mem-build APK yang dibagikan.**

## CI

Job **Android APK** di [`ci.yml`](../.github/workflows/ci.yml) mem-build APK
debug tiap push dan meng-upload-nya sebagai artifact `natcon2026-apk-debug`.
Itu penjaga supaya proyek Android tidak diam-diam rusak; APK yang dibagikan
ke peserta tetap harus di-build dengan `VITE_API_URL` yang asli.
