import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import Icon from '../../components/Icon'
import { api } from '../../api/client'
import { getQueue, enqueueScan, flushQueue } from '../../api/offlineQueue'
import { toast } from '../../components/Toast'

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
  const [result, setResult] = useState(null) // {kind:'ok'|'dup'|'err'|'queued', title, detail}
  const [cameraError, setCameraError] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [pending, setPending] = useState(() => getQueue().length)
  const scannerRef = useRef(null)
  const busyRef = useRef(false)
  const lastCodeRef = useRef({ code: '', at: 0 })

  // Flush the offline scan queue on mount and whenever we come back online.
  const sync = async () => {
    const { synced, remaining } = await flushQueue((code) => api.scan(code))
    setPending(remaining)
    if (synced > 0) toast(`${synced} offline scan(s) synced`)
  }

  useEffect(() => {
    api.booth().then(setBooth).catch(() => {})
    sync()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          title: 'Already scanned',
          detail: `${res.member_name} is already recorded at this booth — pin count unchanged`,
        })
      } else {
        setResult({
          kind: 'ok',
          title: 'Scan successful',
          detail: `${res.member_name} · ${res.member_chapter} — pin +1 (total ${res.coupons})`,
        })
      }
    } catch (err) {
      if (err.status === 0) {
        // Offline: queue the scan; it syncs automatically when back online.
        const count = enqueueScan(code)
        setPending(count)
        setResult({
          kind: 'queued',
          title: 'Offline — scan queued',
          detail: `${code} queued (${count} waiting) — syncs automatically once you're back online`,
        })
      } else {
        setResult({
          kind: 'err',
          title: 'Scan failed',
          detail: err.status === 404 ? 'Not recognized as a Natcon attendee — check the ticket number, member ID or phone' : err.message,
        })
      }
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
          'Camera unavailable (' +
            (err?.message || err) +
            '). Use the manual input below.'
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
          <p>{booth ? `${booth.name} · ${booth.kind === 'sponsor' ? 'Sponsor' : 'Booth'} ${booth.booth}` : 'Loading…'}</p>
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
            <div className="vf-hint">Point at the attendee QR code</div>
          )}
        </div>
      </div>

      {result && (
        <div className={`scan-result ${result.kind}`} key={result.title + result.detail}>
          <div className="sr-row">
            <div className="sr-ic">
              <Icon name={result.kind === 'ok' ? 'check' : result.kind === 'queued' ? 'save' : 'alert'} size={20} />
            </div>
            <div>
              <h4>{result.title}</h4>
              <p>{result.detail}</p>
            </div>
          </div>
        </div>
      )}

      {pending > 0 && (
        <div className="queue-note">
          {pending} scan(s) waiting to sync —{' '}
          <button type="button" onClick={sync}>
            sync now
          </button>
        </div>
      )}

      <form className="manual-scan" onSubmit={submitManual}>
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Manual input: ticket number, member ID or phone"
        />
        <button type="submit">Check</button>
      </form>
      <div style={{ height: 24 }} />
    </>
  )
}
