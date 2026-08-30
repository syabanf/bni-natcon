import { useEffect, useState } from 'react'

/*
 * The front door: bninatcon.com itself, matching the committee's countdown
 * design — a red hero cut on the diagonal, "See you in Jakarta", and a row
 * of white cards counting red digits down to doors-open.
 *
 * No links anywhere, at the committee's request: this is a poster until
 * credentials go out. /login and /tenant/login still answer for anyone who
 * has the address. The programme — rundown and learning sessions — opens as
 * a popup on request, so the poster itself stays a poster.
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

function dayOf(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Jakarta' })
}

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}

export default function Landing() {
  const [ms, setMs] = useState(remaining)
  const [agenda, setAgenda] = useState(null)
  const [sheet, setSheet] = useState(null) // null | 'rundown' | 'classes'
  const [classDetail, setClassDetail] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setMs(remaining()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    // The printed programme, public by design — the poster works signed out.
    fetch('/api/v1/public/agenda')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAgenda(d))
      .catch(() => {})
  }, [])

  const live = ms === 0
  const s = Math.floor(ms / 1000)
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60

  // The poster advertises conference day only — the breakfast the morning
  // after belongs to the ticket, not the countdown.
  const rundown = agenda?.rundown?.length
    ? agenda.rundown.filter((b) => dayOf(b.starts_at) === dayOf(agenda.rundown[0].starts_at))
    : []
  // Best effort: the class's session block on the rundown carries its hours.
  const slotBlock = (slot) => rundown.find((b) => b.title === `Learning Session ${slot}`)

  const close = () => {
    setSheet(null)
    setClassDetail(null)
  }

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

        {/* The programme opens on request — the poster itself stays a poster. */}
        <div className="landing-actions">
          <button type="button" onClick={() => setSheet('rundown')}>
            Event Rundown
          </button>
          <button type="button" onClick={() => setSheet('classes')}>
            Learning Sessions
          </button>
        </div>

        <p className="landing-foot">bninatcon.com</p>
      </main>

      {sheet && (
        <div className="sponsor-sheet-backdrop agenda-backdrop" onClick={close}>
          <div className="sponsor-sheet agenda-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sponsor-sheet-head">
              <h3>{sheet === 'rundown' ? 'Event Rundown' : 'Learning Sessions'}</h3>
              <button type="button" className="sponsor-sheet-close" onClick={close}>
                Close
              </button>
            </div>
            {!agenda && <p className="landing-section-sub">Loading the programme…</p>}

            {sheet === 'rundown' && rundown.length > 0 && (
              <div className="landing-rundown">
                {rundown.map((b) => (
                  <div className="lr-row" key={b.id}>
                    <span className="lr-time">{timeOf(b.starts_at)}</span>
                    <div className="lr-body">
                      <h5>{b.title}</h5>
                      {b.place && <p>{b.place}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sheet === 'classes' &&
              agenda?.classes?.length > 0 &&
              (classDetail ? (
                <div className="lc-detail">
                  <button type="button" className="lc-back" onClick={() => setClassDetail(null)}>
                    ‹ All sessions
                  </button>
                  {classDetail.cover_url && <img src={classDetail.cover_url} alt="" />}
                  <span className="lc-room">{classDetail.room}</span>
                  <h4>{classDetail.title}</h4>
                  <p className="lc-speaker">{classDetail.speaker}</p>
                  {classDetail.moderator && (
                    <p className="lc-mod">Moderator: {classDetail.moderator}</p>
                  )}
                  {slotBlock(classDetail.slot) && (
                    <p className="lc-slot">
                      Session {classDetail.slot} · {timeOf(slotBlock(classDetail.slot).starts_at)}
                      –{timeOf(slotBlock(classDetail.slot).ends_at)} WIB
                    </p>
                  )}
                  {classDetail.description && (
                    <p className="lc-desc-full">{classDetail.description}</p>
                  )}
                </div>
              ) : (
                <>
                  <p className="landing-section-sub">
                    Four sessions across two time slots — attendees pick one from each slot.
                    Tap a session for its details.
                  </p>
                  <div className="landing-classes">
                    {agenda.classes.map((c) => (
                      <article
                        className="lc-card"
                        key={c.room}
                        role="button"
                        tabIndex={0}
                        onClick={() => setClassDetail(c)}
                        onKeyDown={(e) => e.key === 'Enter' && setClassDetail(c)}
                      >
                        {c.cover_url && <img src={c.cover_url} alt="" loading="lazy" />}
                        <div className="lc-body">
                          <span className="lc-room">{c.room}</span>
                          <h5>{c.title}</h5>
                          <p className="lc-speaker">{c.speaker}</p>
                          {c.moderator && <p className="lc-mod">Moderator: {c.moderator}</p>}
                          {c.description && <p className="lc-desc">{c.description}</p>}
                          <span className="lc-more">View details ›</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
