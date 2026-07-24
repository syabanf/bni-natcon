import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { api } from '../../api/client'
import { toast } from '../../components/Toast'

export default function Seminars() {
  const [seminars, setSeminars] = useState(null)
  const [busyID, setBusyID] = useState(null)

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
      toast('Terdaftar — panitia akan scan QR-mu di pintu ruangan')
    } catch (err) {
      toast(err.message)
    } finally {
      setBusyID(null)
      load()
    }
  }

  if (seminars === null) {
    return <div className="loading-note">Memuat seminar…</div>
  }

  const slots = [...new Set(seminars.map((s) => s.slot))].sort()

  return (
    <>
      <div className="hero-greet">
        <h2>Seminar Paralel</h2>
        <p>2 seminar berjalan bersamaan — pilih salah satu, lalu tunjukkan QR-mu ke panitia di pintu.</p>
      </div>

      {slots.map((slot) => {
        const inSlot = seminars.filter((s) => s.slot === slot)
        const pickedInSlot = inSlot.some((s) => s.registered)
        return (
          <div key={slot}>
            <div className="slot-label">Sesi Paralel · 13:00 – 14:30</div>
            {inSlot.map((s) => {
              const few = s.seats_left <= 10
              const locked = pickedInSlot && !s.registered
              const full = s.seats_left <= 0
              return (
                <div className="card seminar-card" key={s.id}>
                  <div className="seminar-cover">
                    <div className="sc-tag">{s.room}</div>
                    <span className="pill" style={{ color: few ? 'var(--red)' : 'var(--ink)' }}>
                      {s.seats_left} kursi tersisa{few && !full ? ' · hampir penuh' : ''}
                    </span>
                  </div>
                  <div className="seminar-body">
                    <h4>{s.title}</h4>
                    <div className="sp-speaker">
                      <Icon name="user" size={13} />
                      {s.speaker}
                    </div>
                    <div className="seminar-actions">
                      {s.registered ? (
                        <button className="btn done">
                          <Icon name="check" size={15} />
                          Terdaftar — tunjukkan QR di pintu {s.room}
                        </button>
                      ) : locked ? (
                        <button className="btn" disabled>
                          Kamu sudah memilih seminar lain
                        </button>
                      ) : full ? (
                        <button className="btn" disabled>
                          Kursi penuh
                        </button>
                      ) : (
                        <button className="btn" onClick={() => register(s.id)} disabled={busyID === s.id}>
                          {busyID === s.id ? 'Mendaftar…' : 'Daftar Sesi Ini'}
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
