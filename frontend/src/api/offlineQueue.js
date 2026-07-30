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

// Kirim ulang antrean satu per satu. Item yang gagal karena jaringan
// dipertahankan; yang ditolak server (mis. kode tak dikenal) dibuang agar
// tidak macet selamanya.
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
      if (err?.status === 0) {
        remaining.push(item) // masih offline — coba lagi nanti
      }
      // status lain (404/403/…) berarti server menolak: buang dari antrean
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
  return { synced, remaining: remaining.length }
}
