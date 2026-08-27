import { useCallback, useEffect, useState } from 'react'
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

function timeAgo(iso) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  return `${hours} h ago`
}

const POLL_MS = 5000

// Full visitor profile + editable note, opened from the visitor list.
function VisitorDetail({ memberId, onBack }) {
  const [visitor, setVisitor] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .visitorDetail(memberId)
      .then((d) => {
        setVisitor(d.visitor)
        setNote(d.visitor.note || '')
      })
      .catch((e) => setError(e.message))
  }, [memberId])

  const saveNote = async () => {
    setSaving(true)
    try {
      await api.setVisitorNote(memberId, note.trim())
      toast('Note saved')
    } catch (err) {
      toast(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="tenant-head">
        <div>
          <button type="button" className="back-link" onClick={onBack}>
            ← Back to dashboard
          </button>
          <h2>Visitor Detail</h2>
        </div>
      </div>
      {error && <div className="empty-note">{error}</div>}
      {visitor && (
        <>
          <div className="contact-card">
            <div className="cc-avatar">{initials(visitor.name)}</div>
            <h3>{visitor.name}</h3>
            <p className="cc-biz">{visitor.company || '—'}</p>
            {visitor.chapter && <span className="pill red">{visitor.chapter}</span>}
            {/* No phone number here on purpose. A scan means somebody agreed
                to be counted at this stand, not to hand over their WhatsApp;
                the committee's leads export is where follow-up comes from. */}
          </div>
          <div className="net-list" style={{ marginTop: 14 }}>
            {visitor.member_code && (
              <div className="net-person">
                <div className="np-av history">ID</div>
                <div className="np-info">
                  <h5>Member Code</h5>
                  <p>{visitor.member_code}</p>
                </div>
              </div>
            )}
            <div className="net-person">
              <div className="np-av history">
                <Icon name="save" size={16} />
              </div>
              <div className="np-info">
                <h5>Visited</h5>
                <p>{new Date(visitor.visited_at).toLocaleString('en-GB')}</p>
              </div>
            </div>
          </div>
          <div className="section-title" style={{ marginLeft: 20 }}>
            Lead note
          </div>
          <div className="manual-scan" style={{ marginTop: 8 }}>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. interested in bulk order, follow up Monday"
              maxLength={500}
            />
            <button type="button" onClick={saveNote} disabled={saving}>
              {saving ? '…' : 'Save'}
            </button>
          </div>
        </>
      )}
      <div style={{ height: 24 }} />
    </>
  )
}

export default function Dashboard() {
  const [booth, setBooth] = useState(null)
  const [stats, setStats] = useState(null)
  const [visitors, setVisitors] = useState([])
  const [detailId, setDetailId] = useState(null)

  const load = useCallback(() => {
    api.boothStats().then(setStats).catch(() => {})
    api
      .boothVisitors(10)
      .then((data) => setVisitors(data.visitors || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    api.booth().then(setBooth).catch(() => {})
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  if (detailId) {
    // Reload on the way back so a note written in the detail view shows up in
    // the list straight away instead of waiting for the next poll.
    return (
      <VisitorDetail
        memberId={detailId}
        onBack={() => {
          setDetailId(null)
          load()
        }}
      />
    )
  }

  return (
    <>
      <div className="tenant-head">
        <div>
          <h2>Booth Dashboard</h2>
          <p>{booth ? `${booth.name} · Live` : 'Loading…'}</p>
        </div>
        <span className="pill green">LIVE</span>
      </div>

      <div className="tenant-stats">
        <div className="stat">
          <div className="st-num" style={{ color: 'var(--red)' }}>
            {stats?.total_scans ?? '–'}
          </div>
          <div className="st-label">Total scans</div>
        </div>
        <div className="stat">
          <div className="st-num">{stats?.scans_today ?? '–'}</div>
          <div className="st-label">Scans today</div>
        </div>
      </div>

      <div className="section-title" style={{ marginLeft: 20 }}>
        Recent visitors <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--gray)' }}>· tap for detail &amp; notes</span>
      </div>
      <div className="visitor-list">
        {visitors.map((v, i) => (
          <button
            className="visitor clickable"
            key={`${v.member_id}-${v.visited_at}-${i}`}
            onClick={() => v.member_id && setDetailId(v.member_id)}
            style={{ width: '100%', textAlign: 'left' }}
          >
            <div className="v-av">{initials(v.name)}</div>
            <div className="v-info">
              <h5>{v.name}</h5>
              <p>{v.note ? `📝 ${v.note}` : v.chapter}</p>
            </div>
            <div className="v-time">{timeAgo(v.visited_at)}</div>
            <span className="np-arrow">→</span>
          </button>
        ))}
      </div>
      {visitors.length === 0 && (
        <div className="empty-note">No visitors yet — scan the first attendee QR in the Scanner tab.</div>
      )}
      <div className="empty-note">
        Add a note per visitor (tap a row) — your notes show up right in this list and become your
        follow-up lead sheet.
      </div>
      <div style={{ height: 16 }} />
    </>
  )
}
