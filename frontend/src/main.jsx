import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// PWA: daftarkan service worker hanya di build produksi supaya cache tidak
// mengganggu HMR saat development.
//
// Di dalam APK (Capacitor) service worker justru berbahaya: aset app sudah
// ada di dalam APK, dan cache SW yang basi bisa menyajikan versi lama walau
// user sudah install APK baru. Jadi lewati saat berjalan di native.
const isNativeApp = !!window.Capacitor?.isNativePlatform?.()
if (import.meta.env.PROD && !isNativeApp && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
