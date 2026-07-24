import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { api } from '../../api/client'
import { toast } from '../../components/Toast'

function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function RoundTimer() {
  const [secs, setSecs] = useState(14 * 60 + 32)
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 15 * 60)), 1000)
    return () => clearInterval(t)
  }, [])
  const m = String(Math.floor(secs / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return (
    <div className="round-timer">
      <div className="rt-time">
        {m}:{s}
      </div>
      <div className="rt-label">sisa ronde</div>
    </div>
  )
}

// Eight seats spread evenly around the table circle, like the mockup.
function TableCircle({ tableNo, mates }) {
  const R = 89
  const C = 112.5
  return (
    <div className="table-circle">
      <div className="table-center">
        <div className="tc-num">{tableNo}</div>
        <div className="tc-label">Meja</div>
      </div>
      {mates.slice(0, 8).map((p, i) => {
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2
        const x = C + R * Math.cos(angle) - 23
        const y = C + R * Math.sin(angle) - 23
        return (
          <div
            key={p.member_id}
            className={`seat${p.is_me ? ' me' : ''}`}
            style={{ left: x, top: y }}
            title={p.name}
          >
            {initials(p.name)}
          </div>
        )
      })}
    </div>
  )
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function TableHistoryDetail({ tableNo, onBack }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = () =>
    api
      .networkingTableDetail(tableNo)
      .then(setData)
      .catch((e) => setError(e.message))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableNo])

  const save = async (m) => {
    try {
      await api.saveContact(m.member_id)
      toast('Kontak tersimpan')
      await load()
    } catch (err) {
      toast(err.message)
    }
  }

  return (
    <>
      <div className="hero-greet">
        <button type="button" className="back-link" onClick={onBack}>
          ← Kembali ke riwayat
        </button>
        <h2>Detail Meja {tableNo}</h2>
        <p>{data ? `${data.table.hall} · ${data.table.occupied}/${data.table.capacity} kursi terisi saat ini` : 'Memuat…'}</p>
      </div>
      {error && <div className="empty-note">{error}</div>}
      {data && (
        <>
          <div className="section-title" style={{ margin: '24px 20px 12px' }}>
            Penghuni meja saat ini
          </div>
          <div className="net-list" style={{ marginTop: 0 }}>
            {data.members.map((m) => (
              <div key={m.member_id} className={`net-person${m.is_me ? ' is-me' : ''}`}>
                <div className="np-av">{initials(m.name)}</div>
                <div className="np-info">
                  <h5>
                    {m.name}
                    {m.is_me && (
                      <span className="pill red" style={{ marginLeft: 6, fontSize: 9.5, padding: '2px 8px' }}>
                        KAMU
                      </span>
                    )}
                  </h5>
                  <p>{m.company || m.chapter}</p>
                </div>
                {!m.is_me &&
                  (m.saved ? (
                    <span className="np-save saved">Tersimpan</span>
                  ) : (
                    <button className="np-save" onClick={() => save(m)}>
                      + Simpan
                    </button>
                  ))}
              </div>
            ))}
            {data.members.length === 0 && (
              <div className="empty-note">Meja ini sedang kosong.</div>
            )}
          </div>
        </>
      )}
      <div style={{ height: 24 }} />
    </>
  )
}

function ContactHistoryDetail({ contactId, onBack }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .networkingContactDetail(contactId)
      .then(setData)
      .catch((e) => setError(e.message))
  }, [contactId])

  return (
    <>
      <div className="hero-greet">
        <button type="button" className="back-link" onClick={onBack}>
          ← Kembali ke riwayat
        </button>
        <h2>Detail Kontak</h2>
        <p>Simpanan dari speed networking — siap untuk follow-up 1-on-1.</p>
      </div>
      {error && <div className="empty-note">{error}</div>}
      {data && (
        <>
          <div className="contact-card">
            <div className="cc-avatar">{initials(data.name)}</div>
            <h3>{data.name}</h3>
            <p className="cc-biz">{data.company || '—'}</p>
            {data.chapter && <span className="pill red">{data.chapter}</span>}
          </div>
          <div className="net-list" style={{ marginTop: 14 }}>
            {data.member_code && (
              <div className="net-person">
                <div className="np-av history">ID</div>
                <div className="np-info">
                  <h5>Member Code</h5>
                  <p>{data.member_code}</p>
                </div>
              </div>
            )}
            <div className="net-person">
              <div className="np-av history">
                <Icon name="save" size={16} />
              </div>
              <div className="np-info">
                <h5>Disimpan pada</h5>
                <p>{fmtTime(data.saved_at)}</p>
              </div>
            </div>
            <div className="net-person">
              <div className="np-av history">
                <Icon name="users" size={16} />
              </div>
              <div className="np-info">
                <h5>Posisi sekarang</h5>
                <p>
                  {data.current_table_no
                    ? `Meja ${data.current_table_no} · Hall B`
                    : 'Sedang tidak di meja networking'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
      <div style={{ height: 24 }} />
    </>
  )
}

function HistoryView({ onBack }) {
  const [history, setHistory] = useState(null)
  const [detail, setDetail] = useState(null) // null | {type:'table',tableNo} | {type:'contact',id}

  useEffect(() => {
    api
      .networkingHistory()
      .then(setHistory)
      .catch(() => setHistory({ tables: [], contacts: [] }))
  }, [])

  if (detail?.type === 'table') {
    return <TableHistoryDetail tableNo={detail.tableNo} onBack={() => setDetail(null)} />
  }
  if (detail?.type === 'contact') {
    return <ContactHistoryDetail contactId={detail.id} onBack={() => setDetail(null)} />
  }

  if (!history) return <div className="loading-note">Memuat riwayat…</div>

  return (
    <>
      <div className="hero-greet">
        <button type="button" className="back-link" onClick={onBack}>
          ← Kembali ke Speed Networking
        </button>
        <h2>Riwayat Networking</h2>
        <p>Ketuk meja atau kontak untuk melihat detailnya.</p>
      </div>

      <div className="section-title" style={{ margin: '24px 20px 12px' }}>
        Riwayat Meja{' '}
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--gray)' }}>
          · {history.tables.length} check-in
        </span>
      </div>
      <div className="net-list" style={{ marginTop: 0 }}>
        {history.tables.map((t, i) => (
          <button
            className="net-person clickable"
            key={`${t.table_no}-${t.joined_at}-${i}`}
            onClick={() => setDetail({ type: 'table', tableNo: t.table_no })}
          >
            <div className="np-av history">{t.table_no}</div>
            <div className="np-info">
              <h5>Meja {t.table_no}</h5>
              <p>{t.hall}</p>
            </div>
            <span className="np-time">{fmtTime(t.joined_at)}</span>
            <span className="np-arrow">→</span>
          </button>
        ))}
        {history.tables.length === 0 && (
          <div className="empty-note">Belum pernah check-in meja — mulai dari halaman Speed Networking.</div>
        )}
      </div>

      <div className="section-title" style={{ margin: '28px 20px 12px' }}>
        Kontak Tersimpan{' '}
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--gray)' }}>
          · {history.contacts.length} kontak
        </span>
      </div>
      <div className="net-list" style={{ marginTop: 0 }}>
        {history.contacts.map((c, i) => (
          <button
            className="net-person clickable"
            key={`${c.member_id}-${i}`}
            onClick={() => setDetail({ type: 'contact', id: c.member_id })}
          >
            <div className="np-av">{initials(c.name)}</div>
            <div className="np-info">
              <h5>{c.name}</h5>
              <p>{c.company || c.chapter}</p>
            </div>
            <span className="np-time">{fmtTime(c.saved_at)}</span>
            <span className="np-arrow">→</span>
          </button>
        ))}
        {history.contacts.length === 0 && (
          <div className="empty-note">Belum ada kontak tersimpan — simpan teman semejamu!</div>
        )}
      </div>
      <div style={{ height: 24 }} />
    </>
  )
}

export default function Networking() {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const load = () =>
    api
      .networking()
      .then((d) => {
        setData(d)
        setChoosing(false)
      })
      .catch(() => setData({ checked_in: false, tables: [] }))

  useEffect(() => {
    load()
  }, [])

  const checkIn = async (tableNo) => {
    setBusy(true)
    try {
      await api.networkingCheckIn(tableNo)
      toast(`Check-in Meja ${tableNo} — otomatis terhubung dengan semeja`)
      await load()
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  const save = async (mate) => {
    try {
      await api.saveContact(mate.member_id)
      toast('Kontak tersimpan — siap untuk follow-up 1-on-1')
      await load()
    } catch (err) {
      toast(err.message)
    }
  }

  const saveAll = async () => {
    setBusy(true)
    try {
      await api.saveAllContacts()
      toast('Semua kontak semeja tersimpan')
      await load()
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!data) return <div className="loading-note">Memuat speed networking…</div>

  /* ----- Riwayat meja & kontak ----- */
  if (showHistory) {
    return <HistoryView onBack={() => setShowHistory(false)} />
  }

  /* ----- Belum check-in: pilih meja ----- */
  if (!data.checked_in || choosing) {
    return (
      <>
        <div className="hero-greet">
          <h2>Speed Networking</h2>
          <p>Scan QR di mejamu — sistem otomatis menghubungkan 8 orang dalam satu network.</p>
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          <button className="history-btn" onClick={() => setShowHistory(true)}>
            <Icon name="save" size={15} />
            Riwayat Meja &amp; Kontak Tersimpan
            <span className="hb-arrow">→</span>
          </button>
        </div>
        <div className="section-title" style={{ margin: '20px 20px 12px' }}>
          Pilih meja{' '}
          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--gray)' }}>
            · pengganti scan QR meja untuk demo
          </span>
        </div>
        <div className="table-grid">
          {data.tables.map((t) => {
            const full = t.occupied >= t.capacity
            const mine = data.checked_in && data.table?.table_no === t.table_no
            return (
              <button
                key={t.table_no}
                className={`table-option${mine ? ' mine' : ''}`}
                disabled={busy || full || mine}
                onClick={() => checkIn(t.table_no)}
              >
                <b>Meja {t.table_no}</b>
                <small>{t.hall}</small>
                <span className={`pill ${full ? 'red' : t.occupied > 0 ? 'green' : 'gray'}`}>
                  {mine ? 'Mejamu' : full ? 'Penuh' : `${t.occupied}/${t.capacity} terisi`}
                </span>
              </button>
            )
          })}
        </div>
        {data.checked_in && (
          <div style={{ padding: '6px 20px 24px' }}>
            <button className="btn ghost" onClick={() => setChoosing(false)}>
              Batal pindah meja
            </button>
          </div>
        )}
        <div style={{ height: 24 }} />
      </>
    )
  }

  /* ----- Sudah check-in ----- */
  const others = data.mates.filter((m) => !m.is_me)
  const allSaved = others.length > 0 && others.every((m) => m.saved)

  return (
    <>
      <div className="hero-greet">
        <h2>Speed Networking</h2>
        <p>Semua yang check-in di mejamu otomatis saling mendapat kontak.</p>
      </div>
      <div style={{ padding: '16px 20px 16px' }}>
        <button className="history-btn" onClick={() => setShowHistory(true)}>
          <Icon name="save" size={15} />
          Riwayat Meja &amp; Kontak Tersimpan
          <span className="hb-arrow">→</span>
        </button>
      </div>

      <div className="net-hero">
        <div className="nh-row">
          <div>
            <div className="nh-label">Penempatan kamu</div>
            <h3>
              Meja {data.table.table_no} · Kursi {data.seat_no}
            </h3>
            <p>{data.table.hall} · Ronde 2 dari 3</p>
          </div>
          <RoundTimer />
        </div>
      </div>

      <div className="card table-viz">
        <h4>
          Meja {data.table.table_no} — {data.mates.length} orang terkoneksi
        </h4>
        <p>Semua yang check-in di meja ini otomatis saling mendapat kontak</p>
        <TableCircle tableNo={data.table.table_no} mates={data.mates} />
      </div>

      <div className="section-title" style={{ marginLeft: 20 }}>
        Network kamu di meja ini
      </div>
      <div className="net-list">
        {data.mates.map((m) => (
          <div key={m.member_id} className={`net-person${m.is_me ? ' is-me' : ''}`}>
            <div className="np-av">{initials(m.name)}</div>
            <div className="np-info">
              <h5>
                {m.name}
                {m.is_me && (
                  <span className="pill red" style={{ marginLeft: 6, fontSize: 9.5, padding: '2px 8px' }}>
                    KAMU
                  </span>
                )}
              </h5>
              <p>{m.company || m.chapter}</p>
            </div>
            {!m.is_me &&
              (m.saved ? (
                <span className="np-save saved">Tersimpan</span>
              ) : (
                <button className="np-save" onClick={() => save(m)}>
                  + Simpan
                </button>
              ))}
          </div>
        ))}
        {others.length === 0 && (
          <div className="empty-note">Belum ada peserta lain di meja ini — ajak temanmu check-in!</div>
        )}
      </div>

      <div style={{ padding: '16px 20px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {others.length > 0 &&
          (allSaved ? (
            <button className="btn done">
              <Icon name="check" size={15} />
              {others.length} kontak tersimpan
            </button>
          ) : (
            <button className="btn ghost" onClick={saveAll} disabled={busy}>
              <Icon name="save" size={16} />
              Simpan semua {others.length} kontak
            </button>
          ))}
        <button className="btn cancel" style={{ marginTop: 0 }} onClick={() => setChoosing(true)}>
          Pindah meja
        </button>
      </div>
      <div style={{ height: 24 }} />
    </>
  )
}
