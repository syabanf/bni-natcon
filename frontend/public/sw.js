/*
 * Service worker BNI Natcon 2026 — app-shell cache supaya QR peserta tetap
 * tampil tanpa sinyal di venue.
 *
 * Strategi:
 *  - /api/*        : selalu network (data live; antrean offline diurus app).
 *  - navigasi      : network-first, fallback ke shell ter-cache saat offline.
 *  - aset statis   : stale-while-revalidate (cepat + tetap segar).
 */
// One cache per build. The id arrives in the script URL
// (/sw.js?v=<build>), so a deploy starts a new cache and the activate
// handler below drops every older one — shell and assets together.
const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE = `natcon-shell-${BUILD}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/'])).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // data live, jangan di-cache

  // Navigasi halaman: network-first, fallback shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone()
          caches.open(CACHE).then((cache) => cache.put('/', copy))
          return resp
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Aset: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetching = fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return resp
        })
        .catch(() => cached)
      return cached || fetching
    })
  )
})
