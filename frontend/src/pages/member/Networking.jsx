import { useEffect, useRef, useState } from 'react'
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

// Company, chapter and business classification — who somebody is across a
// networking table.
//
// No phone number. This used to carry a WhatsApp link, which meant every
// tablemate's number was on everyone else's screen the moment they sat down.
// Saving a contact still records the meeting for both of them, and the
// committee's export is where numbers live; here, people swap them the way
// they would at any other table — by choosing to.
function MateMeta({ m }) {
  return (
    <>
      {m.company && <p>{m.company}</p>}
      {m.chapter && <p className="np-chapter">{m.chapter}</p>}
      {m.classification && (
        <div className="np-meta">
          <span className="np-class">{m.classification}</span>
        </div>
      )}
    </>
  )
}

// Accepts "TABLE:5", "MEJA:5", "T5", or a plain number as the table QR payload.
// Exported so a test can pin it to the payload the admin QR Prints page
// actually prints, instead of a copy of this regex drifting out of sync.
export function parseTableCode(raw) {
  // Anchored at both ends on purpose: unanchored, the tail of a member code
  // ("NATCON-2026-09001") matched as table 1 and quietly seated the scanner
  // at the wrong table instead of reporting a wrong QR.
  const m = String(raw).trim().toUpperCase().match(/^(?:TABLE|MEJA|T)?[:\s-]*(\d{1,3})$/)
  return m ? parseInt(m[1], 10) : 0
}

/*
 * The round clock.
 *
 * This used to be a number in the browser: it started at 14:32 on every page
 * load and looped back to 15:00 at zero, so two people at the same table saw
 * different times and a refresh bought you a fresh round. It now counts down
 * to the moment the committee set.
 *
 * The countdown is measured against the server's clock, not the phone's — a
 * phone ten minutes out would otherwise show a countdown ten minutes wrong.
 */
export function remainingSeconds(session, wallClockNow = Date.now()) {
  if (!session?.ends_at || !session?.server_now) return null
  if (!session.running) return 0
  // How far this device's clock sits from the server's, measured once when
  // the round was fetched.
  const skew = wallClockNow - new Date(session.fetched_at ?? session.server_now).getTime()
  const serverNow = new Date(session.server_now).getTime() + skew
  return Math.max(0, Math.round((new Date(session.ends_at).getTime() - serverNow) / 1000))
}

function RoundTimer({ session }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const secs = remainingSeconds(session)
  if (secs === null) {
    return (
      <div className="round-timer">
        <div className="rt-time">--:--</div>
        <div className="rt-label">waiting to start</div>
      </div>
    )
  }
  const m = String(Math.floor(secs / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return (
    <div className="round-timer">
      <div className="rt-time">
        {m}:{s}
      </div>
      <div className="rt-label">{secs === 0 ? 'round over' : 'round left'}</div>
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
        <div className="tc-label">Table</div>
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
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// Camera scanner for the table QR — html5-qrcode is imported on demand so
// it stays out of the main bundle.
function TableQRScanner({ onCode, onError }) {
  useEffect(() => {
    let scanner
    let cancelled = false
    import('html5-qrcode')
      .then(({ Html5Qrcode }) => {
        if (cancelled) return
        scanner = new Html5Qrcode('table-qr-reader')
        return scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 190, height: 190 } },
          (text) => onCode(text),
          () => {}
        )
      })
      .catch((err) => onError(err?.message || String(err)))
    return () => {
      cancelled = true
      if (scanner && scanner.isScanning) {
        scanner.stop().then(() => scanner.clear()).catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <div id="table-qr-reader" />
}

// Inline note editor used on table mates and contact detail.
function NoteEditor({ initial, onSave, placeholder }) {
  const [value, setValue] = useState(initial || '')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      await onSave(value.trim())
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="note-editor">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || 'Add a note about this person…'}
        maxLength={500}
      />
      <button type="button" onClick={save} disabled={saving}>
        {saving ? '…' : 'Save'}
      </button>
    </div>
  )
}

function MateRow({ m, onSaveContact, onSaveNote }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className={`net-person${m.is_me ? ' is-me' : ''}`} style={{ flexWrap: 'wrap' }}>
      <div className="np-av">{initials(m.name)}</div>
      <div className="np-info">
        <h5>
          {m.name}
          {m.is_me && (
            <span className="pill red" style={{ marginLeft: 6, fontSize: 9.5, padding: '2px 8px' }}>
              YOU
            </span>
          )}
        </h5>
        <MateMeta m={m} />
        {m.saved && m.note && !editing && <p className="np-note">📝 {m.note}</p>}
      </div>
      {!m.is_me && (
        <div className="np-actions">
          {!m.saved && (
            <button className="np-save" onClick={() => onSaveContact(m)}>
              + Save
            </button>
          )}
          <button
            className={`np-save note${m.saved ? ' saved' : ''}`}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Close' : m.note ? 'Edit note' : '+ Note'}
          </button>
        </div>
      )}
      {editing && (
        <NoteEditor
          initial={m.note}
          onSave={async (note) => {
            await onSaveNote(m, note)
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}

function ContactHistoryDetail({ contactId, onBack }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [editingNote, setEditingNote] = useState(false)

  const load = () =>
    api
      .networkingContactDetail(contactId)
      .then(setData)
      .catch((e) => setError(e.message))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId])

  const saveNote = async (note) => {
    try {
      await api.setContactNote(contactId, note)
      toast('Note saved')
      setEditingNote(false)
      await load()
    } catch (err) {
      toast(err.message)
    }
  }

  return (
    <>
      <div className="hero-greet">
        <button type="button" className="back-link" onClick={onBack}>
          ← Back to history
        </button>
        <h2>Contact Detail</h2>
        <p>Saved from speed networking — ready for a 1-on-1 follow-up.</p>
      </div>
      {error && <div className="empty-note">{error}</div>}
      {data && (
        <>
          <div className="contact-card">
            <div className="cc-avatar">{initials(data.name)}</div>
            <h3>{data.name}</h3>
            <p className="cc-biz">{data.company || '—'}</p>
            {data.classification && <p className="cc-class">{data.classification}</p>}
            {data.chapter && <span className="pill red">{data.chapter}</span>}
            <div className="contact-actions">
              {data.phone && (
                <a className="btn" href={`tel:${data.phone}`}>
                  <Icon name="mic" size={15} /> Call
                </a>
              )}
              {data.email && (
                <a className="btn ghost" href={`mailto:${data.email}`}>
                  ✉ Email
                </a>
              )}
            </div>
          </div>
          <div className="net-list" style={{ marginTop: 14 }}>
            {data.phone && (
              <a className="net-person clickable" href={`tel:${data.phone}`} style={{ textDecoration: 'none' }}>
                <div className="np-av history">☎</div>
                <div className="np-info">
                  <h5>Phone</h5>
                  <p>{data.phone}</p>
                </div>
                <span className="np-arrow">→</span>
              </a>
            )}
            {data.email && (
              <a className="net-person clickable" href={`mailto:${data.email}`} style={{ textDecoration: 'none' }}>
                <div className="np-av history">✉</div>
                <div className="np-info">
                  <h5>Email</h5>
                  <p>{data.email}</p>
                </div>
                <span className="np-arrow">→</span>
              </a>
            )}
            {data.member_code && (
              <div className="net-person">
                <div className="np-av history">ID</div>
                <div className="np-info">
                  <h5>Member Code</h5>
                  <p>{data.member_code}</p>
                </div>
              </div>
            )}
            <div className="net-person" style={{ flexWrap: 'wrap' }}>
              <div className="np-av history">📝</div>
              <div className="np-info">
                <h5>My note</h5>
                <p>{data.note || 'No note yet'}</p>
              </div>
              <button className="np-save" onClick={() => setEditingNote((v) => !v)}>
                {editingNote ? 'Close' : data.note ? 'Edit' : '+ Add'}
              </button>
              {editingNote && <NoteEditor initial={data.note} onSave={saveNote} />}
            </div>
            <div className="net-person">
              <div className="np-av history">
                <Icon name="save" size={16} />
              </div>
              <div className="np-info">
                <h5>Saved on</h5>
                <p>{fmtTime(data.saved_at)}</p>
              </div>
            </div>
            <div className="net-person">
              <div className="np-av history">
                <Icon name="users" size={16} />
              </div>
              <div className="np-info">
                <h5>Current position</h5>
                <p>
                  {data.current_table_no
                    ? `Table ${data.current_table_no} · Hall B`
                    : 'Not at a networking table right now'}
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
      toast('Contact saved')
      await load()
    } catch (err) {
      toast(err.message)
    }
  }

  return (
    <>
      <div className="hero-greet">
        <button type="button" className="back-link" onClick={onBack}>
          ← Back to history
        </button>
        <h2>Table {tableNo} Detail</h2>
        <p>
          {data
            ? `${data.table.hall ? `${data.table.hall} · ` : ''}${data.table.occupied}/${data.table.capacity} seats taken right now`
            : 'Loading…'}
        </p>
      </div>
      {error && <div className="empty-note">{error}</div>}
      {data && (
        <>
          <div className="section-title" style={{ margin: '24px 20px 12px' }}>
            Currently at this table
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
                        YOU
                      </span>
                    )}
                  </h5>
                  <MateMeta m={m} />
                </div>
                {!m.is_me &&
                  (m.saved ? (
                    <span className="np-save saved">Saved</span>
                  ) : (
                    <button className="np-save" onClick={() => save(m)}>
                      + Save
                    </button>
                  ))}
              </div>
            ))}
            {data.members.length === 0 && <div className="empty-note">This table is empty right now.</div>}
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

  if (!history) return <div className="loading-note">Loading history…</div>

  return (
    <>
      <div className="hero-greet">
        <button type="button" className="back-link" onClick={onBack}>
          ← Back to Speed Networking
        </button>
        <h2>Networking History</h2>
        <p>Tap a table or contact to see its details.</p>
      </div>

      <div className="section-title" style={{ margin: '24px 20px 12px' }}>
        Table History{' '}
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--gray)' }}>
          · {history.tables.length} check-ins
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
              <h5>Table {t.table_no}</h5>
              <p>{t.hall}</p>
            </div>
            <span className="np-time">{fmtTime(t.joined_at)}</span>
            <span className="np-arrow">→</span>
          </button>
        ))}
        {history.tables.length === 0 && (
          <div className="empty-note">No table check-ins yet — start from the Speed Networking page.</div>
        )}
      </div>

      <div className="section-title" style={{ margin: '28px 20px 12px' }}>
        Saved Contacts{' '}
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--gray)' }}>
          · {history.contacts.length} contacts
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
              <p>{c.note ? `📝 ${c.note}` : c.company || c.chapter}</p>
              {c.classification && (
                <div className="np-meta">
                  <span className="np-class">{c.classification}</span>
                </div>
              )}
            </div>
            <span className="np-time">{fmtTime(c.saved_at)}</span>
            <span className="np-arrow">→</span>
          </button>
        ))}
        {history.contacts.length === 0 && (
          <div className="empty-note">No saved contacts yet — save your tablemates!</div>
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
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const lastScanRef = useRef({ code: '', at: 0 })

  const load = () =>
    api
      .networking()
      .then((d) => {
        setData(d)
        setChoosing(false)
      })
      .catch(() => setData({ checked_in: false, tables: [] }))

  const [session, setSession] = useState(null)
  const loadSession = () =>
    api
      .networkingSession()
      .then((s) => setSession({ ...s, fetched_at: new Date().toISOString() }))
      .catch(() => {})

  useEffect(() => {
    load()
    loadSession()
    // The committee can start the next round at any moment, and the clock on
    // this screen has to follow it.
    const t = setInterval(loadSession, 20000)
    return () => clearInterval(t)
  }, [])

  // Speed networking fills a table over a couple of minutes. Whoever sat down
  // first would otherwise stare at a half-empty table until they navigated
  // away and back — and never see the newcomer's Save button.
  const seated = data?.checked_in && !choosing
  useEffect(() => {
    if (!seated) return undefined
    const t = setInterval(() => {
      api
        .networking()
        .then((d) => setData((prev) => (prev?.checked_in ? d : prev)))
        .catch(() => {})
    }, 5000)
    return () => clearInterval(t)
  }, [seated])

  const checkIn = async (tableNo) => {
    setBusy(true)
    try {
      await api.networkingCheckIn(tableNo)
      toast(`Checked in at Table ${tableNo} — auto-connected with your tablemates`)
      setCameraOn(false)
      await load()
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onScanCode = (raw) => {
    const now = Date.now()
    if (lastScanRef.current.code === raw && now - lastScanRef.current.at < 3000) return
    lastScanRef.current = { code: raw, at: now }
    const tableNo = parseTableCode(raw)
    if (!tableNo) {
      toast('That QR is not a networking table code')
      return
    }
    checkIn(tableNo)
  }

  const save = async (mate) => {
    try {
      await api.saveContact(mate.member_id)
      toast('Contact saved — ready for a 1-on-1 follow-up')
      await load()
    } catch (err) {
      toast(err.message)
    }
  }

  const saveNote = async (mate, note) => {
    try {
      // A note is only stored against a saved contact, so writing one for
      // someone you haven't saved yet saves them first.
      if (!mate.saved) await api.saveContact(mate.member_id)
      await api.setContactNote(mate.member_id, note)
      toast('Note saved')
      await load()
    } catch (err) {
      toast(err.message)
    }
  }

  const saveAll = async () => {
    setBusy(true)
    try {
      await api.saveAllContacts()
      toast('All tablemates saved to your contacts')
      await load()
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!data) return <div className="loading-note">Loading speed networking…</div>

  /* ----- History ----- */
  if (showHistory) {
    return <HistoryView onBack={() => setShowHistory(false)} />
  }

  /* ----- Not checked in: scan the table QR first ----- */
  if (!data.checked_in || choosing) {
    return (
      <>
        <div className="hero-greet">
          <h2>Speed Networking</h2>
          <p>Scan the QR on your table — you'll drop straight into your table's network.</p>
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          <button className="history-btn" onClick={() => setShowHistory(true)}>
            <Icon name="save" size={15} />
            Table History &amp; Saved Contacts
            <span className="hb-arrow">→</span>
          </button>
        </div>

        <div className="scanner-zone" style={{ marginTop: 18 }}>
          {cameraOn ? (
            <div className="viewfinder">
              <TableQRScanner onCode={onScanCode} onError={(msg) => setCameraError(msg)} />
              {cameraError ? (
                <div className="vf-hint" style={{ position: 'static', padding: '20px 24px' }}>
                  Camera unavailable ({cameraError}). Ask a committee member at the table — they
                  can seat you from the admin panel.
                </div>
              ) : (
                <div className="vf-hint">Point at the table QR code</div>
              )}
            </div>
          ) : (
            <button className="btn" onClick={() => setCameraOn(true)} disabled={busy}>
              <Icon name="qr" size={16} />
              Scan table QR
            </button>
          )}
        </div>

        <div className="empty-note" style={{ marginTop: 16 }}>
          Every table seats 10 people. Scan the QR on your table to check in — everyone at the table
          is connected automatically. No table number to type: the QR is what puts you at the right
          one.
        </div>
        {data.checked_in && (
          <div style={{ padding: '6px 20px 24px' }}>
            <button className="btn ghost" onClick={() => setChoosing(false)}>
              Cancel table move
            </button>
          </div>
        )}
        <div style={{ height: 24 }} />
      </>
    )
  }

  /* ----- Checked in ----- */
  const others = data.mates.filter((m) => !m.is_me)
  const allSaved = others.length > 0 && others.every((m) => m.saved)

  return (
    <>
      <div className="hero-greet">
        <h2>Speed Networking</h2>
        <p>Everyone checked in at your table automatically shares contacts.</p>
      </div>
      <div style={{ padding: '16px 20px 16px' }}>
        <button className="history-btn" onClick={() => setShowHistory(true)}>
          <Icon name="save" size={15} />
          Table History &amp; Saved Contacts
          <span className="hb-arrow">→</span>
        </button>
      </div>

      <div className="net-hero">
        <div className="nh-row">
          <div>
            <div className="nh-label">Your placement</div>
            <h3>
              Table {data.table.table_no} · Seat {data.seat_no}
            </h3>
            <p>
              {[data.table.name, data.table.hall].filter(Boolean).join(' · ')}
            </p>
          </div>
          <RoundTimer session={session} />
        </div>
      </div>

      <div className="card table-viz">
        <h4>
          {data.table.name || `Table ${data.table.table_no}`} — {data.mates.length} people connected
        </h4>
        <p>Everyone who checked in at this table automatically shares contacts</p>
        <TableCircle tableNo={data.table.table_no} mates={data.mates} />
      </div>

      <div className="section-title" style={{ marginLeft: 20 }}>
        Your network at this table
      </div>
      <div className="net-list">
        {data.mates.map((m) => (
          <MateRow key={m.member_id} m={m} onSaveContact={save} onSaveNote={saveNote} />
        ))}
        {others.length === 0 && (
          <div className="empty-note">No one else here yet — invite a friend to scan the table QR!</div>
        )}
      </div>

      <div style={{ padding: '16px 20px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {others.length > 0 &&
          (allSaved ? (
            <button className="btn done">
              <Icon name="check" size={15} />
              {others.length} contacts saved
            </button>
          ) : (
            <button className="btn ghost" onClick={saveAll} disabled={busy}>
              <Icon name="save" size={16} />
              Save all {others.length} contacts
            </button>
          ))}
        <button className="btn cancel" style={{ marginTop: 0 }} onClick={() => setChoosing(true)}>
          Move to another table
        </button>
      </div>
      <div style={{ height: 24 }} />
    </>
  )
}
