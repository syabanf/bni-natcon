/*
 * Antrean scan offline untuk booth tenant: saat server tak terjangkau,
 * scan disimpan lokal lalu disinkronkan otomatis begitu online kembali.
 */
const QUEUE_KEY = 'natcon-scan-queue'

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []
  } catch {
    return []
  }
}

export function enqueueScan(memberCode) {
  const queue = getQueue()
  queue.push({ member_code: memberCode, at: new Date().toISOString() })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  return queue.length
}

// Gagal yang sifatnya sementara: jaringan mati (0), sesi habis (401 — booth
// tinggal login lagi lalu antrean terkirim), rate limit (408/429), dan semua
// error sisi server (5xx). Semua ini HARUS disimpan; membuangnya berarti
// kunjungan yang benar-benar terjadi di booth hilang tanpa jejak.
const isTransient = (status) =>
  status === 0 || status === 401 || status === 408 || status === 429 || status >= 500

// Kirim ulang antrean satu per satu. Yang gagal sementara dipertahankan;
// yang memang ditolak server (kode tak dikenal 404, duplikat 409) dibuang
// agar antrean tidak macet selamanya.
export async function flushQueue(scanFn) {
  const queue = getQueue()
  if (queue.length === 0) return { synced: 0, remaining: 0 }

  let synced = 0
  const remaining = []
  for (const item of queue) {
    try {
      await scanFn(item.member_code)
      synced++
    } catch (err) {
      if (isTransient(err?.status)) remaining.push(item)
      // 404/409/400: server menolak kodenya — tidak akan pernah berhasil.
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
  return { synced, remaining: remaining.length }
}
