/*
 * Demo mock mode untuk admin panel: seluruh endpoint admin dilayani dari
 * localStorage — tanpa backend. Bentuk respons sama persis dengan API asli
 * sehingga semua halaman (dashboard, CRUD, import, laporan, detail) bekerja
 * tanpa perubahan.
 */

const STATE_KEY = 'natcon-admin-mock-state'
const MODE_KEY = 'natcon-admin-mock'

export const isMockMode = () => localStorage.getItem(MODE_KEY) === '1'
export const setMockMode = (on) => {
  if (on) localStorage.setItem(MODE_KEY, '1')
  else localStorage.removeItem(MODE_KEY)
}

function todayAt(h, m = 0) {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

function seedState() {
  const members = [
    ['Reddie Wijaya', 'reddie@natcon.id', 'NATCON-2026-08154', 'BNI Chapter Jakarta Elite', 'Witid Intelligence'],
    ['Sinta Dewi', 'sinta@natcon.id', 'NATCON-2026-08201', 'BNI Chapter Jakarta Elite', 'Sinta Florist'],
    ['Agus Santoso', 'agus@natcon.id', 'NATCON-2026-08322', 'BNI Chapter Bandung Raya', 'Santoso Baja'],
    ['Budi Hartanto', 'budi@natcon.id', 'NATCON-2026-09001', 'Chapter Yogya Istimewa', 'Budi Craft Studio'],
    ['Citra Lestari', 'citra@natcon.id', 'NATCON-2026-09002', 'Chapter Tangerang Hebat', 'Citra Media'],
    ['Dewi Anggraini', 'dewi@natcon.id', 'NATCON-2026-09003', 'Chapter Bali Paradise', 'Dewi Spa'],
    ['Fajar Nugroho', 'fajar@natcon.id', 'NATCON-2026-09004', 'Chapter Bekasi Sinergi', 'Fajar Motor'],
    ['Lusi Anggraini', 'lusi@natcon.id', 'NATCON-2026-09005', 'Chapter Jakarta Elite', 'Lusi Catering'],
  ].map(([name, email, code, chapter, company], i) => ({
    id: i + 1, name, email, member_code: code, chapter, company,
    phone: `+62811${String(1000 + i)}`,
  }))

  const tenants = [
    ['BNI Xpora', 'Main Sponsor', 'SP-01', 'BX', 'sponsor', "BNI's one-stop export hub."],
    ['Wondr by BNI', 'Digital Sponsor', 'SP-02', 'WB', 'sponsor', 'Personal finance super-app.'],
    ['Kopi Nusantara', 'F&B', 'A-03', 'KN', 'booth', 'Single-origin Indonesian coffee.'],
    ['Bank Mitra Sejahtera', 'Finance', 'A-05', 'BM', 'booth', 'SME lending partner.'],
    ['Garuda Print Media', 'Printing', 'A-08', 'GP', 'booth', 'Large-format printing.'],
    ['TechNesia Solutions', 'IT & Software', 'B-01', 'TS', 'booth', 'Custom software & cloud.'],
    ['Sehat Selalu Clinic', 'Healthcare', 'B-04', 'SS', 'booth', 'Corporate health checks.'],
    ['Properti Prima', 'Property', 'B-07', 'PP', 'booth', 'Commercial property advisory.'],
    ['Logistik Cepat', 'Logistics', 'C-02', 'LC', 'booth', 'Same-day nationwide delivery.'],
    ['Asuransi Aman', 'Insurance', 'C-05', 'AA', 'booth', 'Business insurance for SMEs.'],
    ['Kreasi Digital', 'Marketing', 'C-08', 'KD', 'booth', 'Performance marketing studio.'],
    ['Hukum & Rekan', 'Legal', 'D-01', 'HR', 'booth', 'Corporate legal counsel.'],
    ['EduPro Training', 'Training', 'D-04', 'EP', 'booth', 'Certified professional training.'],
    ['Katering Rasa', 'F&B', 'D-06', 'KR', 'booth', 'Premium event catering.'],
  ].map(([name, category, booth, initials, kind, description], i) => ({
    id: i + 1, name, category, booth, initials, kind, description,
    owner_email: `booth-${booth.toLowerCase().replace('-', '')}@natcon.id`,
  }))

  const seminars = [
    { id: 1, slot: 1, room: 'R. Merapi', title: 'Scaling Referral: From Chapter to Nationwide', speaker: 'Ir. Bambang Wicaksono — National Director', capacity: 60, description: 'Turning one-to-one referrals into a national pipeline.', cover_url: '' },
    { id: 2, slot: 1, room: 'R. Rinjani', title: 'AI for SMEs: Practical, Not Hype', speaker: 'Dr. Sarah Kusuma — Witid Intelligence', capacity: 40, description: 'AI tools an SME can deploy this quarter.', cover_url: '' },
  ]

  // (member_id, tenant_id, jam, menit) — tersebar supaya grafik hidup.
  const visits = [
    [1, 3, 9, 5], [2, 3, 9, 34], [3, 6, 9, 44], [4, 3, 10, 12],
    [5, 4, 10, 30], [6, 6, 11, 2], [7, 5, 11, 15], [1, 6, 11, 40],
    [2, 1, 12, 5], [8, 3, 13, 20], [4, 2, 13, 45], [6, 1, 14, 10],
  ].map(([member_id, tenant_id, h, m]) => ({ member_id, tenant_id, at: todayAt(h, m) }))

  const registrations = [
    { member_id: 1, seminar_id: 1, at: todayAt(10, 46) },
    { member_id: 2, seminar_id: 2, at: todayAt(10, 50) },
    { member_id: 4, seminar_id: 1, at: todayAt(11, 0) },
    { member_id: 6, seminar_id: 2, at: todayAt(11, 20) },
  ]

  // Sebagian sudah check-in di pintu untuk demo laporan kehadiran.
  const attendance = [{ member_id: 1, seminar_id: 1, at: todayAt(12, 55) }]

    const chapters = [...new Set(members.map((m) => m.chapter).filter(Boolean))]
    .sort()
    .map((name, i) => ({ id: 900 + i, name }))

  const tables = Array.from({ length: 12 }, (_, i) => ({
    id: 800 + i, table_no: i + 1, hall: 'Hall B', capacity: 8, occupied: 0,
  }))

  return {
    nextId: 1000, nextCode: 9100, members, tenants, seminars, visits,
    registrations, attendance, chapters, tables,
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    // attendance ditambahkan belakangan; state lama perlu default-nya.
    if (raw) return { attendance: [], chapters: [], tables: [], ...JSON.parse(raw) }
  } catch {
    /* fresh */
  }
  const s = seedState()
  localStorage.setItem(STATE_KEY, JSON.stringify(s))
  return s
}

function save(s) {
  localStorage.setItem(STATE_KEY, JSON.stringify(s))
}

export function resetMockState() {
  localStorage.removeItem(STATE_KEY)
}

function delay(result) {
  return new Promise((resolve) => setTimeout(() => resolve(result), 150))
}

function fail(status, message) {
  const err = new Error(message)
  err.status = status
  return Promise.reject(err)
}

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString()

function memberById(s, id) {
  return s.members.find((m) => m.id === Number(id))
}
function tenantById(s, id) {
  return s.tenants.find((t) => t.id === Number(id))
}
function visitCount(s, memberId) {
  return s.visits.filter((v) => v.member_id === memberId).length
}
function seatsTaken(s, seminarId) {
  return s.registrations.filter((r) => r.seminar_id === seminarId).length
}

function ensureChapter(s, name) {
  name = (name || '').trim()
  if (!name) return
  if (!s.chapters.some((c) => c.name === name)) {
    s.chapters.push({ id: s.nextId++, name })
  }
}

function createMemberRow(s, { name, email, chapter = '', company = '', phone = '' }) {
  name = (name || '').trim()
  email = (email || '').trim().toLowerCase()
  if (!name || !email) throw { status: 400, message: 'invalid input: name and email are required' }
  if (!validEmail(email)) throw { status: 400, message: 'invalid input: invalid email format' }
  if (s.members.some((m) => m.email === email)) throw { status: 409, message: 'that email is already used by another account' }
  ensureChapter(s, chapter)
  const row = {
    id: s.nextId++, name, email, chapter, company, phone: String(phone || '').trim(),
    member_code: `NATCON-2026-0${s.nextCode++}`,
  }
  s.members.push(row)
  return row
}

// Create-or-update keyed by email (import semantics).
function upsertMemberRow(s, { name, email, chapter = '', company = '', phone = '' }) {
  name = (name || '').trim()
  email = (email || '').trim().toLowerCase()
  if (!name || !email) throw { status: 400, message: 'invalid input: name and email are required' }
  if (!validEmail(email)) throw { status: 400, message: 'invalid input: invalid email format' }
  ensureChapter(s, chapter)
  const existing = s.members.find((m) => m.email === email)
  if (existing) {
    Object.assign(existing, {
      name, chapter: (chapter || '').trim(), company: (company || '').trim(),
      phone: String(phone || '').trim(),
    })
    return { created: false }
  }
  const row = {
    id: s.nextId++, name, email, chapter: (chapter || '').trim(), company: (company || '').trim(),
    phone: String(phone || '').trim(),
    member_code: `NATCON-2026-0${s.nextCode++}`,
  }
  s.members.push(row)
  return { created: true }
}

function createTenantRow(s, { name, category = '', booth, initials = '', email = '', kind = 'booth', description = '' }) {
  name = (name || '').trim()
  booth = (booth || '').trim()
  if (!name || !booth) throw { status: 400, message: 'invalid input: name and booth are required' }
  email = (email || '').trim().toLowerCase() ||
    `booth-${booth.toLowerCase().replace(/-/g, '')}@natcon.id`
  if (!validEmail(email)) throw { status: 400, message: 'invalid input: invalid email format' }
  if (s.tenants.some((t) => t.owner_email === email)) throw { status: 409, message: 'that email is already used by another account' }
  initials = (initials || name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)).toUpperCase()
  kind = String(kind).toLowerCase() === 'sponsor' ? 'sponsor' : 'booth'
  const row = { id: s.nextId++, name, category, booth, initials, kind, description, owner_email: email }
  s.tenants.push(row)
  return row
}

// Create-or-update keyed by booth code (import semantics).
function upsertTenantRow(s, { name, category = '', booth, initials = '', email = '', kind = 'booth', description = '' }) {
  name = (name || '').trim()
  booth = (booth || '').trim()
  if (!name || !booth) throw { status: 400, message: 'invalid input: name and booth are required' }
  email = (email || '').trim().toLowerCase() ||
    `booth-${booth.toLowerCase().replace(/-/g, '')}@natcon.id`
  if (!validEmail(email)) throw { status: 400, message: 'invalid input: invalid email format' }
  kind = String(kind).toLowerCase() === 'sponsor' ? 'sponsor' : 'booth'
  initials = (initials || name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)).toUpperCase()

  const existing = s.tenants.find((t) => t.booth === booth)
  if (existing) {
    Object.assign(existing, { name, category, initials, kind, description })
    return { created: false }
  }
  if (s.tenants.some((t) => t.owner_email === email)) {
    throw { status: 409, message: 'that email is already used by another account' }
  }
  s.tenants.push({ id: s.nextId++, name, category, booth, initials, kind, description, owner_email: email })
  return { created: true }
}

export const mockAdminApi = {
  login(email) {
    if ((email || '').trim().toLowerCase() !== 'admin@natcon.id') {
      return fail(401, 'Demo mode: use admin@natcon.id (any password)')
    }
    return delay({
      token: 'mock-admin-token',
      user: { id: 0, name: 'Natcon Committee', email: 'admin@natcon.id', role: 'admin' },
    })
  },

  overview() {
    const s = load()
    return delay({
      total_members: s.members.length,
      total_tenants: s.tenants.length,
      total_visits: s.visits.length,
      visits_today: s.visits.filter((v) => isToday(v.at)).length,
      members_with_visit: new Set(s.visits.map((v) => v.member_id)).size,
      seminar_registrations: s.registrations.length,
    })
  },

  tenants() {
    const s = load()
    const rows = s.tenants
      .map((t) => ({
        ...t,
        scan_count: s.visits.filter((v) => v.tenant_id === t.id).length,
      }))
      .sort((a, b) => b.scan_count - a.scan_count || a.booth.localeCompare(b.booth))
    return delay({ tenants: rows })
  },

  seminars() {
    const s = load()
    return delay({
      seminars: s.seminars.map((sem) => ({ ...sem, seats_taken: seatsTaken(s, sem.id) })),
    })
  },

  activity(limit = 15) {
    const s = load()
    const rows = [...s.visits]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit)
      .map((v) => {
        const m = memberById(s, v.member_id)
        const t = tenantById(s, v.tenant_id)
        return {
          member_name: m?.name || '?', chapter: m?.chapter || '',
          tenant_name: t?.name || '?', booth: t?.booth || '', visited_at: v.at,
        }
      })
    return delay({ activity: rows })
  },

  /* ----- Members CRUD ----- */

  members({ q = '', page = 1, limit = 50 } = {}) {
    const s = load()
    const needle = q.trim().toLowerCase()
    const all = [...s.members]
      .filter((m) =>
        !needle ||
        [m.name, m.email, m.member_code, m.chapter]
          .some((f) => (f || '').toLowerCase().includes(needle))
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({ ...m, visits: visitCount(s, m.id) }))
    const start = (Math.max(1, page) - 1) * limit
    return delay({
      members: all.slice(start, start + limit),
      total: all.length,
      page: Math.max(1, page),
      limit,
    })
  },

  seminarCheckin(seminarId, memberCode) {
    const s = load()
    const sem = s.seminars.find((x) => x.id === Number(seminarId))
    if (!sem) return fail(404, 'data not found')
    const member = s.members.find((m) => m.member_code === (memberCode || '').trim())
    if (!member) return fail(404, 'data not found')
    const registered = s.registrations.some(
      (r) => r.seminar_id === sem.id && r.member_id === member.id
    )
    if (!registered) return fail(409, 'this attendee is not registered for this seminar')
    const duplicate = s.attendance.some(
      (a) => a.seminar_id === sem.id && a.member_id === member.id
    )
    if (!duplicate) {
      s.attendance.push({ seminar_id: sem.id, member_id: member.id, at: new Date().toISOString() })
      save(s)
    }
    return delay({
      member_name: member.name,
      member_code: member.member_code,
      member_chapter: member.chapter,
      duplicate,
      attended_count: s.attendance.filter((a) => a.seminar_id === sem.id).length,
    })
  },

  createMember(body) {
    const s = load()
    try {
      const row = createMemberRow(s, body)
      save(s)
      return delay({ user: { ...row, role: 'member' } })
    } catch (e) {
      return fail(e.status, e.message)
    }
  },

  updateMember(id, body) {
    const s = load()
    const m = memberById(s, id)
    if (!m) return fail(404, 'data not found')
    const email = (body.email || '').trim().toLowerCase()
    if (!body.name?.trim() || !email) return fail(400, 'invalid input: name and email are required')
    if (!validEmail(email)) return fail(400, 'invalid input: invalid email format')
    if (s.members.some((x) => x.email === email && x.id !== m.id)) {
      return fail(409, 'that email is already used by another account')
    }
    ensureChapter(s, body.chapter)
    Object.assign(m, { name: body.name.trim(), email, chapter: body.chapter || '', company: body.company || '', phone: (body.phone || m.phone || '').trim() })
    save(s)
    return delay({ status: 'updated' })
  },

  deleteMember(id) {
    const s = load()
    if (!memberById(s, id)) return fail(404, 'data not found')
    s.members = s.members.filter((m) => m.id !== Number(id))
    s.visits = s.visits.filter((v) => v.member_id !== Number(id))
    s.registrations = s.registrations.filter((r) => r.member_id !== Number(id))
    save(s)
    return delay({ status: 'deleted' })
  },

  memberDetail(id) {
    const s = load()
    const m = memberById(s, id)
    if (!m) return fail(404, 'data not found')
    const visits = s.visits
      .filter((v) => v.member_id === m.id)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((v) => {
        const t = tenantById(s, v.tenant_id)
        return { tenant_name: t?.name || '?', booth: t?.booth || '', visited_at: v.at }
      })
    const registrations = s.registrations
      .filter((r) => r.member_id === m.id)
      .map((r) => {
        const sem = s.seminars.find((x) => x.id === r.seminar_id)
        return { slot: sem?.slot || 0, room: sem?.room || '?', title: sem?.title || '?', registered_at: r.at }
      })
    return delay({ user: { ...m, role: 'member' }, visits, registrations })
  },

  /* ----- Tenants CRUD ----- */

  createTenant(body) {
    const s = load()
    try {
      const row = createTenantRow(s, body)
      save(s)
      return delay({ tenant: row })
    } catch (e) {
      return fail(e.status, e.message)
    }
  },

  updateTenant(id, body) {
    const s = load()
    const t = tenantById(s, id)
    if (!t) return fail(404, 'data not found')
    if (!body.name?.trim() || !body.booth?.trim()) {
      return fail(400, 'invalid input: name and booth are required')
    }
    Object.assign(t, {
      name: body.name.trim(), category: body.category || '',
      booth: body.booth.trim(), initials: (body.initials || t.initials).toUpperCase(),
      kind: String(body.kind || t.kind || 'booth').toLowerCase() === 'sponsor' ? 'sponsor' : 'booth',
      description: body.description ?? t.description ?? '',
    })
    save(s)
    return delay({ status: 'updated' })
  },

  deleteTenant(id) {
    const s = load()
    if (!tenantById(s, id)) return fail(404, 'data not found')
    s.tenants = s.tenants.filter((t) => t.id !== Number(id))
    s.visits = s.visits.filter((v) => v.tenant_id !== Number(id))
    save(s)
    return delay({ status: 'deleted' })
  },

  tenantDetail(id) {
    const s = load()
    const t = tenantById(s, id)
    if (!t) return fail(404, 'data not found')
    const rows = s.visits
      .filter((v) => v.tenant_id === t.id)
      .sort((a, b) => b.at.localeCompare(a.at))
    return delay({
      tenant: t,
      total_scans: rows.length,
      scans_today: rows.filter((v) => isToday(v.at)).length,
      visitors: rows.map((v) => {
        const m = memberById(s, v.member_id)
        return { name: m?.name || '?', chapter: m?.chapter || '', company: m?.company || '', visited_at: v.at }
      }),
    })
  },

  /* ----- Seminars CRUD ----- */

  createSeminar(body) {
    const s = load()
    if (!body.room?.trim() || !body.title?.trim()) return fail(400, 'invalid input: room and title are required')
    if (!(Number(body.capacity) > 0)) return fail(400, 'invalid input: capacity must be greater than 0')
    const row = {
      id: s.nextId++, slot: Number(body.slot) || 1, room: body.room.trim(),
      title: body.title.trim(), speaker: body.speaker || '', capacity: Number(body.capacity),
      description: body.description || '', cover_url: body.cover_url || '',
    }
    s.seminars.push(row)
    save(s)
    return delay({ seminar: row })
  },

  updateSeminar(id, body) {
    const s = load()
    const sem = s.seminars.find((x) => x.id === Number(id))
    if (!sem) return fail(404, 'data not found')
    if (!body.room?.trim() || !body.title?.trim()) return fail(400, 'invalid input: room and title are required')
    if (!(Number(body.capacity) > 0)) return fail(400, 'invalid input: capacity must be greater than 0')
    Object.assign(sem, {
      slot: Number(body.slot) || 1, room: body.room.trim(), title: body.title.trim(),
      speaker: body.speaker || '', capacity: Number(body.capacity),
      description: body.description ?? sem.description ?? '', cover_url: body.cover_url ?? sem.cover_url ?? '',
    })
    save(s)
    return delay({ status: 'updated' })
  },

  deleteSeminar(id) {
    const s = load()
    if (!s.seminars.some((x) => x.id === Number(id))) return fail(404, 'data not found')
    s.seminars = s.seminars.filter((x) => x.id !== Number(id))
    s.registrations = s.registrations.filter((r) => r.seminar_id !== Number(id))
    save(s)
    return delay({ status: 'deleted' })
  },

  seminarDetail(id) {
    const s = load()
    const sem = s.seminars.find((x) => x.id === Number(id))
    if (!sem) return fail(404, 'data not found')
    const attendees = s.registrations
      .filter((r) => r.seminar_id === sem.id)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((r) => {
        const m = memberById(s, r.member_id)
        const att = s.attendance.find(
          (a) => a.seminar_id === sem.id && a.member_id === r.member_id
        )
        return {
          name: m?.name || '?', member_code: m?.member_code || '',
          chapter: m?.chapter || '', company: m?.company || '', registered_at: r.at,
          checked_in: Boolean(att), checked_in_at: att?.at || null,
        }
      })
    return delay({
      seminar: {
        ...sem,
        seats_taken: attendees.length,
        attended_count: attendees.filter((a) => a.checked_in).length,
      },
      attendees,
    })
  },

  /* ----- Bulk import ----- */

  bulkMembers(rows) {
    const s = load()
    let created = 0
    let updated = 0
    const errors = []
    rows.forEach((row, i) => {
      try {
        const res = upsertMemberRow(s, row)
        if (res.created) created++
        else updated++
      } catch (e) {
        errors.push({ row: i + 1, label: row.email || row.name || '?', error: e.message })
      }
    })
    save(s)
    return delay({ created, updated, failed: errors.length, errors })
  },

  // Demo mode keeps the image on-device as a data URL (small files only —
  // localStorage is the backing store).
  uploadImage(file) {
    if (!file.type.startsWith('image/')) return fail(400, 'only images are accepted')
    if (file.size > 300 * 1024) {
      return fail(400, 'demo mode stores images locally — keep them under 300 KB')
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ url: reader.result })
      reader.onerror = () => {
        const err = new Error('could not read the file')
        err.status = 400
        reject(err)
      }
      reader.readAsDataURL(file)
    })
  },

  /* ----- Networking tables ----- */

  tables() {
    const s = load()
    return delay({ tables: [...s.tables].sort((a, b) => a.table_no - b.table_no) })
  },

  generateTables({ count, hall = 'Hall B', capacity = 8 }) {
    const s = load()
    count = Number(count)
    if (!count || count < 1 || count > 500) {
      return fail(400, 'invalid input: number of tables must be between 1 and 500')
    }
    if (!(Number(capacity) > 0)) return fail(400, 'invalid input: capacity must be greater than 0')
    const start = s.tables.reduce((max, t) => Math.max(max, t.table_no), 0)
    const created = Array.from({ length: count }, (_, i) => ({
      id: s.nextId++, table_no: start + i + 1,
      hall: (hall || 'Hall B').trim(), capacity: Number(capacity), occupied: 0,
    }))
    s.tables.push(...created)
    save(s)
    return delay({ created: created.length, tables: created })
  },

  updateTable(id, { hall, capacity }) {
    const s = load()
    const t = s.tables.find((x) => x.id === Number(id))
    if (!t) return fail(404, 'data not found')
    if (!(Number(capacity) > 0)) return fail(400, 'invalid input: capacity must be greater than 0')
    if (Number(capacity) < t.occupied) {
      return fail(400, 'invalid input: capacity is below the seats already taken')
    }
    Object.assign(t, { hall: (hall || t.hall).trim(), capacity: Number(capacity) })
    save(s)
    return delay({ status: 'updated' })
  },

  deleteTable(id) {
    const s = load()
    const t = s.tables.find((x) => x.id === Number(id))
    if (!t) return fail(404, 'data not found')
    if (t.occupied > 0) {
      return fail(409, 'someone is still seated at this table — wait until it empties')
    }
    s.tables = s.tables.filter((x) => x.id !== t.id)
    save(s)
    return delay({ status: 'deleted' })
  },

  /* ----- Chapters ----- */

  chapters() {
    const s = load()
    const rows = [...s.chapters]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({
        ...c,
        members: s.members.filter((m) => m.chapter === c.name).length,
      }))
    return delay({ chapters: rows })
  },

  createChapter(name) {
    const s = load()
    name = (name || '').trim()
    if (!name) return fail(400, 'invalid input: chapter name is required')
    if (s.chapters.some((c) => c.name === name)) return fail(409, 'that name is already in use')
    const row = { id: s.nextId++, name }
    s.chapters.push(row)
    save(s)
    return delay({ chapter: { ...row, members: 0 } })
  },

  renameChapter(id, name) {
    const s = load()
    const c = s.chapters.find((x) => x.id === Number(id))
    if (!c) return fail(404, 'data not found')
    name = (name || '').trim()
    if (!name) return fail(400, 'invalid input: chapter name is required')
    if (s.chapters.some((x) => x.name === name && x.id !== c.id)) {
      return fail(409, 'that name is already in use')
    }
    const oldName = c.name
    c.name = name
    for (const m of s.members) {
      if (m.chapter === oldName) m.chapter = name
    }
    save(s)
    return delay({ status: 'updated' })
  },

  deleteChapter(id) {
    const s = load()
    const c = s.chapters.find((x) => x.id === Number(id))
    if (!c) return fail(404, 'data not found')
    if (s.members.some((m) => m.chapter === c.name)) {
      return fail(409, 'this chapter still has members — move or rename them first')
    }
    s.chapters = s.chapters.filter((x) => x.id !== c.id)
    save(s)
    return delay({ status: 'deleted' })
  },

  bulkTenants(rows) {
    const s = load()
    let created = 0
    let updated = 0
    const errors = []
    rows.forEach((row, i) => {
      try {
        const res = upsertTenantRow(s, row)
        if (res.created) created++
        else updated++
      } catch (e) {
        errors.push({ row: i + 1, label: row.name || '?', error: e.message })
      }
    })
    save(s)
    return delay({ created, updated, failed: errors.length, errors })
  },

  /* ----- Reports ----- */

  visitReport() {
    const s = load()
    const rows = [...s.visits]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((v) => {
        const m = memberById(s, v.member_id)
        const t = tenantById(s, v.tenant_id)
        return {
          member_name: m?.name || '?', member_code: m?.member_code || '',
          chapter: m?.chapter || '', company: m?.company || '',
          tenant_name: t?.name || '?', booth: t?.booth || '', visited_at: v.at,
        }
      })
    return delay({ visits: rows })
  },

  registrationReport() {
    const s = load()
    const rows = [...s.registrations]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((r) => {
        const m = memberById(s, r.member_id)
        const sem = s.seminars.find((x) => x.id === r.seminar_id)
        return {
          member_name: m?.name || '?', member_code: m?.member_code || '',
          chapter: m?.chapter || '', slot: sem?.slot || 0, room: sem?.room || '?',
          seminar_title: sem?.title || '?', registered_at: r.at,
          attended: s.attendance.some(
            (a) => a.seminar_id === r.seminar_id && a.member_id === r.member_id
          ),
        }
      })
    return delay({ registrations: rows })
  },
}
