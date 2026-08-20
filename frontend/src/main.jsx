import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
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
    // The build id rides along in the URL. A new deploy means a new service
    // worker script URL, which means a fresh cache — otherwise the shell
    // cached under "/" keeps pointing at asset files the deploy deleted, and
    // an offline phone opens to a blank page.
    navigator.serviceWorker.register(`/sw.js?v=${__BUILD_ID__}`).catch(() => {})

    // A worker taking over from an older one means the tab is running the
    // previous build. Reload once so the day's fix actually reaches the
    // phone; `hadWorker` keeps a first install from reloading on arrival.
    const hadWorker = !!navigator.serviceWorker.controller
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadWorker || reloaded) return
      reloaded = true
      location.reload()
    })
  })
}
