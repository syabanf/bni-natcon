import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Icon from '../../components/Icon'
import { api, assetUrl } from '../../api/client'
import { toast } from '../../components/Toast'
import { scanCode } from '../../pass'
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

// A class's hour comes from the rundown block it sits in. Empty means the
// committee has not placed it yet — better to say nothing than to print a
// time that is not true (MoM 19 Aug 2026).
export function classHours(seminar) {
  if (!seminar?.starts_at || !seminar?.ends_at) return ''
  return `${seminar.starts_at.slice(11, 16)} – ${seminar.ends_at.slice(11, 16)}`
}

function initials(name = '') {
  return name
    .replace(/,.*$/, '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// Classes carry a speaker list with photos. Older records (or a class typed in
// by hand) only have the plain-text speaker/moderator fields, so fall back to
// splitting those on semicolons.
function peopleOf(seminar) {
  if (seminar.speakers?.length) return seminar.speakers
  const out = (seminar.speaker || '')
    .split(';')
    .map((name) => ({ name: name.trim(), role: 'speaker' }))
    .filter((p) => p.name)
  if (seminar.moderator) out.push({ name: seminar.moderator, role: 'moderator' })
  return out
}

function SpeakerLines({ seminar }) {
  const people = peopleOf(seminar)
  if (!people.length) return null
  return (
    <div className="sp-people">
      {people.map((p) => (
        <div className={`sp-person${p.role === 'moderator' ? ' moderator' : ''}`} key={p.name}>
          {p.photo_url ? (
            <img className="sp-photo" src={assetUrl(p.photo_url)} alt="" loading="lazy" />
          ) : (
            <span className="sp-photo fallback">{initials(p.name)}</span>
          )}
          <div className="sp-who">
            <b>{p.name}</b>
            {p.title && <span className="sp-title">{p.title}</span>}
          </div>
          {p.role === 'moderator' && <span className="sp-role">moderator</span>}
        </div>
      ))}
    </div>
  )
}

// Who else is in the room — names and chapters only, so people can spot who
// they want to find. Contact details stay behind speed networking.
function RoomAttendees({ seminarId }) {
  const [people, setPeople] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api
      .seminarAttendees(seminarId)
      .then((d) => setPeople(d.attendees || []))
      .catch(() => setPeople([]))
  }, [seminarId])

  if (people === null) return null
  const shown = open ? people : people.slice(0, 6)

  return (
    <div className="room-attendees">
      <div className="ra-head">
        <h5>In this room</h5>
        <span>{people.length} registered</span>
      </div>
      {people.length === 0 ? (
        <p className="ra-empty">Nobody has registered yet — be the first.</p>
      ) : (
        <>
          <div className="ra-list">
            {shown.map((p) => (
              <div className="ra-person" key={`${p.name}-${p.chapter}`}>
                <span className="ra-av">{initials(p.name)}</span>
                <div className="ra-who">
                  <b>{p.name}</b>
                  <span>{p.company ? `${p.company} · ${p.chapter}` : p.chapter}</span>
                </div>
                {p.checked_in && <span className="ra-in">In the room</span>}
              </div>
            ))}
          </div>
          {people.length > 6 && (
            <button type="button" className="ra-more" onClick={() => setOpen((v) => !v)}>
              {open ? 'Show less' : `Show all ${people.length}`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// Full-page learning class detail: cover, description, speakers/moderator,
// and the member's class entry QR (distinct payload from the general QR).
function SeminarDetail({ seminar, passCode, onBack, onRegister, onCancel, busy, locked }) {
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
        {seminar.poster_url ? (
          <img
            className="seminar-poster"
            src={assetUrl(seminar.poster_url)}
            alt={`${seminar.title} poster`}
          />
        ) : (
          <SeminarCover seminar={seminar} tall />
        )}
        <div className="seminar-body">
          <span className="pill red">
            {seminar.room}
            {classHours(seminar) ? ` · ${classHours(seminar)}` : ' · Learning class'}
          </span>
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
                    <QRCodeSVG value={passCode || ''} size={148} />
                    <b>Class entry pass — {seminar.room}</b>
                    <p>
                      This QR is for the learning class door only (separate from your booth QR). The
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
                You already picked another learning class
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

          <RoomAttendees seminarId={seminar.id} />
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
    return <div className="loading-note">Loading learning classes…</div>
  }

  const detail = seminars.find((s) => s.id === detailID)
  if (detail) {
    const lockedDetail = seminars.some((s) => s.slot === detail.slot && s.registered && s.id !== detail.id)
    return (
      <SeminarDetail
        seminar={detail}
        passCode={scanCode(user)}
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
        <h2>Learning Class</h2>
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
        const hours = classHours(inSlot[0])
        return (
          <div key={slot}>
            <div className="slot-label">
              Parallel learning classes{hours ? ` · ${hours}` : ''}
            </div>
            {inSlot.map((s) => {
              const few = s.seats_left <= 10
              const locked = pickedInSlot && !s.registered
              const full = s.seats_left <= 0
              return (
                <div className="card seminar-card" key={s.id}>
                  <div
                    className={`seminar-cover${s.cover_url ? ' poster' : ''}`}
                    style={
                      s.cover_url
                        ? { backgroundImage: `url(${assetUrl(s.cover_url)})` }
                        : undefined
                    }
                  >
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
