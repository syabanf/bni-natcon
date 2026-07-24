import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import Icon from '../../components/Icon'
import { api } from '../../api/client'

function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function Scanner() {
  const [booth, setBooth] = useState(null)
  const [result, setResult] = useState(null) // {kind:'ok'|'dup'|'err', title, detail}
  const [cameraError, setCameraError] = useState('')
  const [manualCode, setManualCode] = useState('')
  const scannerRef = useRef(null)
  const busyRef = useRef(false)
  const lastCodeRef = useRef({ code: '', at: 0 })

  useEffect(() => {
    api.booth().then(setBooth).catch(() => {})
  }, [])

  const submitCode = async (code) => {
    if (busyRef.current) return
    // Ignore repeats of the same QR within 3 s — the camera decodes
    // continuously while the badge is in frame.
    const now = Date.now()
    if (lastCodeRef.current.code === code && now - lastCodeRef.current.at < 3000) return
    lastCodeRef.current = { code, at: now }

    busyRef.current = true
    try {
      const res = await api.scan(code)
      if (res.duplicate) {
        setResult({
          kind: 'dup',
          title: 'Sudah pernah di-scan',
          detail: `${res.member_name} sudah tercatat di booth ini — kupon tidak bertambah`,
        })
      } else {
        setResult({
          kind: 'ok',
          title: 'Scan berhasil',
          detail: `${res.member_name} · ${res.member_chapter} — kupon door prize +1 (total ${res.coupons})`,
        })
      }
    } catch (err) {
      setResult({
        kind: 'err',
        title: 'Scan gagal',
        detail: err.status === 404 ? 'QR tidak dikenali sebagai peserta Natcon' : err.message,
      })
    } finally {
      busyRef.current = false
    }
  }

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (decodedText) => submitCode(decodedText.trim()),
        () => {} // per-frame decode misses are normal noise
      )
      .catch((err) => {
        setCameraError(
          'Kamera tidak tersedia (' +
            (err?.message || err) +
            '). Gunakan input manual di bawah.'
        )
      })

    return () => {
      const s = scannerRef.current
      if (s && s.isScanning) {
        s.stop().then(() => s.clear()).catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitManual = (e) => {
    e.preventDefault()
    const code = manualCode.trim()
    if (code) {
      lastCodeRef.current = { code: '', at: 0 }
      submitCode(code)
      setManualCode('')
    }
  }

  return (
    <>
      <div className="tenant-head">
        <div>
          <h2>Booth Scanner</h2>
          <p>{booth ? `${booth.name} · Booth ${booth.booth}` : 'Memuat…'}</p>
        </div>
        <div className="avatar">{booth ? booth.initials : initials(booth?.name)}</div>
      </div>

      <div className="scanner-zone">
        <div className="viewfinder">
          <div id="qr-reader" />
          {cameraError ? (
            <div className="vf-hint" style={{ position: 'static', padding: '20px 24px' }}>
              {cameraError}
            </div>
          ) : (
            <div className="vf-hint">Arahkan ke QR Code peserta</div>
          )}
        </div>
      </div>

      {result && (
        <div className={`scan-result ${result.kind}`} key={result.title + result.detail}>
          <div className="sr-row">
            <div className="sr-ic">
              <Icon name={result.kind === 'ok' ? 'check' : 'alert'} size={20} />
            </div>
            <div>
              <h4>{result.title}</h4>
              <p>{result.detail}</p>
            </div>
          </div>
        </div>
      )}

      <form className="manual-scan" onSubmit={submitManual}>
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Input manual: NATCON-2026-XXXXX"
        />
        <button type="submit">Cek</button>
      </form>
      <div style={{ height: 24 }} />
    </>
  )
}
