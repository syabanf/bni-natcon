import { useEffect, useState } from 'react'

/*
 * The front door: bninatcon.com itself, matching the committee's countdown
 * design — a red hero cut on the diagonal, "See you in Jakarta", and a row
 * of white cards counting red digits down to doors-open.
 *
 * No links anywhere, at the committee's request: this is a poster until
 * credentials go out. /login and /tenant/login still answer for anyone who
 * has the address.
 */

// Doors open — Registration & Open Networking, the rundown's first block.
// WIB is pinned in the string, so a phone on Singapore or Amsterdam time
// counts to the same instant.
const DOORS_OPEN = new Date('2026-09-03T07:00:00+07:00').getTime()

function remaining() {
  return Math.max(0, DOORS_OPEN - Date.now())
}

function Unit({ value, label, pad }) {
  return (
    <div className="cd-card">
      <div className="cd-num">{pad ? String(value).padStart(2, '0') : value}</div>
      <div className="cd-label">{label}</div>
    </div>
  )
}

export default function Landing() {
  const [ms, setMs] = useState(remaining)

  useEffect(() => {
    const t = setInterval(() => setMs(remaining()), 1000)
    return () => clearInterval(t)
  }, [])

  const live = ms === 0
  const s = Math.floor(ms / 1000)
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60

  return (
    <div className="landing">
      <header className="landing-hero">
        <img
          className="landing-logo"
          src="/brand/logo-stacked-white.png"
          alt="BNI Indonesia National Conference 2026 — Accelerate"
        />
        <span className="landing-pill">National Conference 2026</span>
        <h1>See you in Jakarta</h1>
      </header>

      <main className="landing-body">
        <p className="landing-when">
          Thursday, <b>3 September 2026 · Pullman Central Park Jakarta</b>
        </p>
        <p className="landing-doors">Registration &amp; Open Networking from 07.00 WIB</p>

        {live ? (
          <p className="landing-live">We are live — see you at registration!</p>
        ) : (
          <>
            <div className="countdown" role="timer" aria-label="Countdown to doors open">
              {/* Days run unpadded the way the reference prints them — "3",
                  not "03" — while the clock units keep their two digits. */}
              <Unit value={days} label="days" />
              <span className="cd-sep">:</span>
              <Unit value={hours} label="hours" pad />
              <span className="cd-sep">:</span>
              <Unit value={minutes} label="minutes" pad />
              <span className="cd-sep">:</span>
              <Unit value={seconds} label="seconds" pad />
            </div>
            <p className="landing-caption">Counting down to doors open — 07.00 WIB</p>
          </>
        )}

        <p className="landing-foot">bninatcon.com</p>
      </main>
    </div>
  )
}
