import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

/*
 * Kamera scanner untuk panitia pintu. Dimuat lazy (React.lazy) supaya
 * html5-qrcode tidak membebani bundle utama admin.
 */
export default function CameraScanner({ onScan, onError }) {
  const busyRef = useRef(false)
  const lastRef = useRef({ code: '', at: 0 })

  useEffect(() => {
    const scanner = new Html5Qrcode('door-qr-reader')
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        async (decoded) => {
          const code = decoded.trim()
          const now = Date.now()
          if (busyRef.current) return
          if (lastRef.current.code === code && now - lastRef.current.at < 3000) return
          lastRef.current = { code, at: now }
          busyRef.current = true
          try {
            await onScan(code)
          } finally {
            busyRef.current = false
          }
        },
        () => {} // frame yang tidak terbaca adalah hal normal
      )
      .catch((err) => onError?.(err?.message || String(err)))

    return () => {
      if (scanner.isScanning) {
        scanner.stop().then(() => scanner.clear()).catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div id="door-qr-reader" className="door-camera" />
}
