import { useEffect, useState } from 'react'

/*
 * The front door: bninatcon.com itself.
 *
 * Before the day, this is a poster — the conference mark and a clock counting
 * down to the moment registration opens (3 September, 07.00 WIB, the first
 * block of the committee's rundown). Once that moment passes it stops being a
 * poster and starts being a doorway, because the only person still reading a
 * countdown on the morning is somebody trying to sign in.
 */

// Registration opens. WIB is fixed in the string, so a phone on Singapore or
// Amsterdam time counts to the same instant.
const DOORS_OPEN = new Date('2026-09-03T07:00:00+07:00').getTime()

function remaining() {
  return Math.max(0, DOORS_OPEN - Date.now())
}

function Unit({ value, label }) {
  return (
    <div className="cd-unit">
      <div className="cd-num">{String(value).padStart(2, '0')}</div>
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
      <img
        className="landing-logo"
        src="/brand/logo-stacked-white.png"
        alt="BNI Indonesia National Conference 2026 — Accelerate"
      />
      <p className="landing-where">3 September 2026 · Pullman Central Park Jakarta</p>

      {live ? (
        <p className="landing-live">We are live — see you at registration!</p>
      ) : (
        <div className="countdown" role="timer" aria-label="Countdown to the conference">
          <Unit value={days} label="days" />
          <span className="cd-sep">:</span>
          <Unit value={hours} label="hours" />
          <span className="cd-sep">:</span>
          <Unit value={minutes} label="minutes" />
          <span className="cd-sep">:</span>
          <Unit value={seconds} label="seconds" />
        </div>
      )}

      {/* No sign-in links at all, at the committee's request — the page is
          purely a poster until credentials go out. /login and /tenant/login
          both still work for anyone who has the address; the landing simply
          does not advertise either. */}

      <p className="landing-foot">System by WIT</p>
    </div>
  )
}
