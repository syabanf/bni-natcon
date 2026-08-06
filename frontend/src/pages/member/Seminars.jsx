import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Icon from '../../components/Icon'
import { api, assetUrl } from '../../api/client'
import { toast } from '../../components/Toast'
import { useAuthStore } from '../../store/auth'

// Cover: uploaded image when set, otherwise a themed gradient per room.
function SeminarCover({ seminar, tall }) {
  if (seminar.cover_url) {
    return (
      <div
        className={`seminar-hero-cover${tall ? ' tall' : ''}`}
        style={{ backgroundImage: `url(${assetUrl(seminar.cover_url)})` }}
      />
    )
  }
  const hue = seminar.room.includes('Merapi') ? 'var(--red)' : '#8b1d64'
  return (
    <div
      className={`seminar-hero-cover${tall ? ' tall' : ''}`}
      style={{ background: `linear-gradient(120deg, ${hue}, #40121c)` }}
    >
      <span className="shc-room">{seminar.room}</span>
      <span className="shc-title">{seminar.title}</span>
    </div>
  )
}

// A class can have more than one speaker (stored comma- or semicolon-separated)
// plus an optional moderator.
function SpeakerLines({ seminar }) {
  const speakers = (seminar.speaker || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!speakers.length && !seminar.moderator) return null
  return (
    <div className="sp-people">
      {speakers.map((name) => (
        <div className="sp-speaker" key={name}>
          <Icon name="mic" size={13} />
          {name}
        </div>
      ))}
      {seminar.moderator && (
        <div className="sp-speaker moderator">
          <Icon name="user" size={13} />
          {seminar.moderator} <span className="sp-role">moderator</span>
        </div>
      )}
    </div>
  )
}

// Full-page breakout class detail: cover, description, speakers/moderator,
// and the member's class entry QR (distinct payload from the general QR).
function SeminarDetail({ seminar, memberCode, onBack, onRegister, onCancel, busy, locked }) {
  const [showQR, setShowQR] = useState(false)
  const full = seminar.seats_left <= 0

  return (
    <>
      <div className="hero-greet">
        <button type="button" className="back-link" onClick={onBack}>
          ← All classes
        </button>
      </div>
      <div className="card seminar-card" style={{ marginTop: 4 }}>
        <SeminarCover seminar={seminar} tall />
        <div className="seminar-body">
          <span className="pill red">{seminar.room} · Breakout class · 13:00 – 14:30</span>
          <h4 style={{ marginTop: 10, fontSize: 17 }}>{seminar.title}</h4>
          <SpeakerLines seminar={seminar} />
          {seminar.description && <p className="seminar-desc">{seminar.description}</p>}
          <div className="seminar-meta">
            <span className="pill gray">{seminar.seats_left} seats left</span>
            {seminar.registered && (
              <span className={`pill ${seminar.attended ? 'green' : 'gray'}`}>
                {seminar.attended ? 'Attended ✓' : 'Not checked in yet'}
              </span>
            )}
          </div>

          <div className="seminar-actions">
            {seminar.registered ? (
              <>
                <button className="btn" onClick={() => setShowQR((v) => !v)}>
                  <Icon name="qr" size={15} />
                  {showQR ? 'Hide class entry QR' : 'Show class entry QR'}
                </button>
                {showQR && (
                  <div className="seminar-qr">
                    <QRCodeSVG value={memberCode || ''} size={148} />
                    <b>Class entry pass — {seminar.room}</b>
                    <p>
                      This QR is for the breakout class door only (separate from your booth QR). The
                      door crew scans it to record your attendance — then claim your{' '}
                      <b>goodiebag</b>.
                    </p>
                  </div>
                )}
                <button className="btn cancel" onClick={() => onCancel(seminar.id)} disabled={busy}>
                  {busy ? 'Cancelling…' : 'Cancel this registration'}
                </button>
              </>
            ) : locked ? (
              <button className="btn" disabled>
                You already picked another breakout class
              </button>
            ) : full ? (
              <button className="btn" disabled>
                Fully booked
              </button>
            ) : (
              <button className="btn" onClick={() => onRegister(seminar.id)} disabled={busy}>
                {busy ? 'Registering…' : 'Register for this class'}
              </button>
            )}
          </div>
        </div>
      </div>
      <div style={{ height: 24 }} />
    </>
  )
}

export default function Seminars() {
  const user = useAuthStore((s) => s.user)
  const [seminars, setSeminars] = useState(null)
  const [busyID, setBusyID] = useState(null)
  const [detailID, setDetailID] = useState(null)

  const load = () =>
    api
      .seminars()
      .then((data) => setSeminars(data.seminars || []))
      .catch(() => setSeminars([]))

  useEffect(() => {
    load()
  }, [])

  const register = async (id) => {
    setBusyID(id)
    try {
      await api.registerSeminar(id)
      toast('Registered — show your class QR at the room door to claim your goodiebag')
    } catch (err) {
      toast(err.message)
    } finally {
      setBusyID(null)
      load()
    }
  }

  const cancel = async (id) => {
    setBusyID(id)
    try {
      await api.unregisterSeminar(id)
      toast('Registration cancelled — you can pick another class')
    } catch (err) {
      toast(err.message)
    } finally {
      setBusyID(null)
      load()
    }
  }

  if (seminars === null) {
    return <div className="loading-note">Loading breakout classes…</div>
  }

  const detail = seminars.find((s) => s.id === detailID)
  if (detail) {
    const lockedDetail = seminars.some((s) => s.slot === detail.slot && s.registered && s.id !== detail.id)
    return (
      <SeminarDetail
        seminar={detail}
        memberCode={user?.member_code}
        onBack={() => setDetailID(null)}
        onRegister={register}
        onCancel={cancel}
        busy={busyID === detail.id}
        locked={lockedDetail}
      />
    )
  }

  const slots = [...new Set(seminars.map((s) => s.slot))].sort()
  const registered = seminars.find((s) => s.registered)

  return (
    <>
      <div className="hero-greet">
        <h2>Breakout Class</h2>
        <p>
          All classes run at the same time — pick one, then show your class QR at the door to claim
          your goodiebag.
        </p>
      </div>

      {registered && (
        <div className="doorprize-banner" style={{ marginTop: 16 }}>
          <div className="db-ic">
            <Icon name="award" size={19} />
          </div>
          <div>
            <h5>{registered.attended ? 'Attendance recorded ✓' : 'Your class ticket is ready'}</h5>
            <p>
              {registered.attended
                ? `Enjoy ${registered.room} — don't forget to claim your goodiebag`
                : `Open ${registered.room} below and show the entry QR at the door to claim your goodiebag`}
            </p>
          </div>
        </div>
      )}

      {slots.map((slot) => {
        const inSlot = seminars.filter((s) => s.slot === slot)
        const pickedInSlot = inSlot.some((s) => s.registered)
        return (
          <div key={slot}>
            <div className="slot-label">Parallel breakout classes · 13:00 – 14:30</div>
            {inSlot.map((s) => {
              const few = s.seats_left <= 10
              const locked = pickedInSlot && !s.registered
              const full = s.seats_left <= 0
              return (
                <div className="card seminar-card" key={s.id}>
                  <div className="seminar-cover">
                    <div className="sc-tag">{s.room}</div>
                    <span className="pill" style={{ color: few ? 'var(--red)' : 'var(--ink)' }}>
                      {s.seats_left} seats left{few && !full ? ' · almost full' : ''}
                    </span>
                  </div>
                  <div className="seminar-body">
                    <h4>{s.title}</h4>
                    <SpeakerLines seminar={s} />
                    {s.description && (
                      <p className="seminar-desc clamp">{s.description}</p>
                    )}
                    <div className="seminar-actions">
                      <button className="btn ghost" onClick={() => setDetailID(s.id)}>
                        View details{s.registered ? ' & entry QR' : ''}
                      </button>
                      {s.registered ? (
                        <button className="btn done" style={{ marginTop: 10 }}>
                          <Icon name="check" size={15} />
                          Registered{s.attended ? ' · attended ✓' : ' — goodiebag on check-in'}
                        </button>
                      ) : locked ? (
                        <button className="btn" style={{ marginTop: 10 }} disabled>
                          You already picked another class
                        </button>
                      ) : full ? (
                        <button className="btn" style={{ marginTop: 10 }} disabled>
                          Fully booked
                        </button>
                      ) : (
                        <button
                          className="btn"
                          style={{ marginTop: 10 }}
                          onClick={() => register(s.id)}
                          disabled={busyID === s.id}
                        >
                          {busyID === s.id ? 'Registering…' : 'Register for this class'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
      <div style={{ height: 24 }} />
    </>
  )
}
