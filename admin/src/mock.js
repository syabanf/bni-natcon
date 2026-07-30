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
  }))

  const tenants = [
    ['Kopi Nusantara', 'F&B', 'A-03', 'KN'],
    ['Bank Mitra Sejahtera', 'Finansial', 'A-05', 'BM'],
    ['Garuda Print Media', 'Percetakan', 'A-08', 'GP'],
    ['TechNesia Solutions', 'IT & Software', 'B-01', 'TS'],
    ['Sehat Selalu Clinic', 'Kesehatan', 'B-04', 'SS'],
    ['Properti Prima', 'Properti', 'B-07', 'PP'],
    ['Logistik Cepat', 'Logistik', 'C-02', 'LC'],
    ['Asuransi Aman', 'Asuransi', 'C-05', 'AA'],
    ['Kreasi Digital', 'Marketing', 'C-08', 'KD'],
    ['Hukum & Rekan', 'Legal', 'D-01', 'HR'],
    ['EduPro Training', 'Pelatihan', 'D-04', 'EP'],
    ['Katering Rasa', 'F&B', 'D-06', 'KR'],
  ].map(([name, category, booth, initials], i) => ({
    id: i + 1, name, category, booth, initials,
    owner_email: `booth-${booth.toLowerCase().replace('-', '')}@natcon.id`,
  }))

  const seminars = [
    { id: 1, slot: 1, room: 'R. Merapi', title: 'Scaling Referral: Dari Chapter ke Nasional', speaker: 'Ir. Bambang Wicaksono — National Director', capacity: 60 },
    { id: 2, slot: 1, room: 'R. Rinjani', title: 'AI untuk UKM: Praktis, Bukan Hype', speaker: 'Dr. Sarah Kusuma — Witid Intelligence', capacity: 40 },
  ]

  // (member_id, tenant_id, jam, menit) — tersebar supaya grafik hidup.
  const visits = [
    [1, 1, 9, 5], [2, 1, 9, 34], [3, 4, 9, 44], [4, 1, 10, 12],
    [5, 2, 10, 30], [6, 4, 11, 2], [7, 3, 11, 15], [1, 4, 11, 40],
    [2, 2, 12, 5], [8, 1, 13, 20], [4, 4, 13, 45], [6, 2, 14, 10],
  ].map(([member_id, tenant_id, h, m]) => ({ member_id, tenant_id, at: todayAt(h, m) }))

  const registrations = [
    { member_id: 1, seminar_id: 1, at: todayAt(10, 46) },
    { member_id: 2, seminar_id: 2, at: todayAt(10, 50) },
    { member_id: 4, seminar_id: 1, at: todayAt(11, 0) },
    { member_id: 6, seminar_id: 2, at: todayAt(11, 20) },
  ]

  // Sebagian sudah check-in di pintu untuk demo laporan kehadiran.
  const attendance = [{ member_id: 1, seminar_id: 1, at: todayAt(12, 55) }]

  return { nextId: 100, nextCode: 9100, members, tenants, seminars, visits, registrations, attendance }
}

function load() {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    // attendance ditambahkan belakangan; state lama perlu default-nya.
    if (raw) return { attendance: [], ...JSON.parse(raw) }
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

function createMemberRow(s, { name, email, chapter = '', company = '' }) {
  name = (name || '').trim()
  email = (email || '').trim().toLowerCase()
  if (!name || !email) throw { status: 400, message: 'input tidak valid: nama dan email wajib diisi' }
  if (!validEmail(email)) throw { status: 400, message: 'input tidak valid: format email tidak valid' }
  if (s.members.some((m) => m.email === email)) throw { status: 409, message: 'email sudah digunakan akun lain' }
  const row = {
    id: s.nextId++, name, email, chapter, company,
    member_code: `NATCON-2026-0${s.nextCode++}`,
  }
  s.members.push(row)
  return row
}

function createTenantRow(s, { name, category = '', booth, initials = '', email = '' }) {
  name = (name || '').trim()
  booth = (booth || '').trim()
  if (!name || !booth) throw { status: 400, message: 'input tidak valid: nama dan booth wajib diisi' }
  email = (email || '').trim().toLowerCase() ||
    `booth-${booth.toLowerCase().replace(/-/g, '')}@natcon.id`
  if (!validEmail(email)) throw { status: 400, message: 'input tidak valid: format email tidak valid' }
  if (s.tenants.some((t) => t.owner_email === email)) throw { status: 409, message: 'email sudah digunakan akun lain' }
  initials = (initials || name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)).toUpperCase()
  const row = { id: s.nextId++, name, category, booth, initials, owner_email: email }
  s.tenants.push(row)
  return row
}

export const mockAdminApi = {
  login(email) {
    if ((email || '').trim().toLowerCase() !== 'admin@natcon.id') {
      return fail(401, 'Mode demo: gunakan admin@natcon.id (password bebas)')
    }
    return delay({
      token: 'mock-admin-token',
      user: { id: 0, name: 'Panitia Natcon', email: 'admin@natcon.id', role: 'admin' },
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
    if (!sem) return fail(404, 'data tidak ditemukan')
    const member = s.members.find((m) => m.member_code === (memberCode || '').trim())
    if (!member) return fail(404, 'data tidak ditemukan')
    const registered = s.registrations.some(
      (r) => r.seminar_id === sem.id && r.member_id === member.id
    )
    if (!registered) return fail(409, 'peserta belum terdaftar di seminar ini')
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
    if (!m) return fail(404, 'data tidak ditemukan')
    const email = (body.email || '').trim().toLowerCase()
    if (!body.name?.trim() || !email) return fail(400, 'input tidak valid: nama dan email wajib diisi')
    if (!validEmail(email)) return fail(400, 'input tidak valid: format email tidak valid')
    if (s.members.some((x) => x.email === email && x.id !== m.id)) {
      return fail(409, 'email sudah digunakan akun lain')
    }
    Object.assign(m, { name: body.name.trim(), email, chapter: body.chapter || '', company: body.company || '' })
    save(s)
    return delay({ status: 'updated' })
  },

  deleteMember(id) {
    const s = load()
    if (!memberById(s, id)) return fail(404, 'data tidak ditemukan')
    s.members = s.members.filter((m) => m.id !== Number(id))
    s.visits = s.visits.filter((v) => v.member_id !== Number(id))
    s.registrations = s.registrations.filter((r) => r.member_id !== Number(id))
    save(s)
    return delay({ status: 'deleted' })
  },

  memberDetail(id) {
    const s = load()
    const m = memberById(s, id)
    if (!m) return fail(404, 'data tidak ditemukan')
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
    if (!t) return fail(404, 'data tidak ditemukan')
    if (!body.name?.trim() || !body.booth?.trim()) {
      return fail(400, 'input tidak valid: nama dan booth wajib diisi')
    }
    Object.assign(t, {
      name: body.name.trim(), category: body.category || '',
      booth: body.booth.trim(), initials: (body.initials || t.initials).toUpperCase(),
    })
    save(s)
    return delay({ status: 'updated' })
  },

  deleteTenant(id) {
    const s = load()
    if (!tenantById(s, id)) return fail(404, 'data tidak ditemukan')
    s.tenants = s.tenants.filter((t) => t.id !== Number(id))
    s.visits = s.visits.filter((v) => v.tenant_id !== Number(id))
    save(s)
    return delay({ status: 'deleted' })
  },

  tenantDetail(id) {
    const s = load()
    const t = tenantById(s, id)
    if (!t) return fail(404, 'data tidak ditemukan')
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
    if (!body.room?.trim() || !body.title?.trim()) return fail(400, 'input tidak valid: ruang dan judul wajib diisi')
    if (!(Number(body.capacity) > 0)) return fail(400, 'input tidak valid: kapasitas harus lebih dari 0')
    const row = {
      id: s.nextId++, slot: Number(body.slot) || 1, room: body.room.trim(),
      title: body.title.trim(), speaker: body.speaker || '', capacity: Number(body.capacity),
    }
    s.seminars.push(row)
    save(s)
    return delay({ seminar: row })
  },

  updateSeminar(id, body) {
    const s = load()
    const sem = s.seminars.find((x) => x.id === Number(id))
    if (!sem) return fail(404, 'data tidak ditemukan')
    if (!body.room?.trim() || !body.title?.trim()) return fail(400, 'input tidak valid: ruang dan judul wajib diisi')
    if (!(Number(body.capacity) > 0)) return fail(400, 'input tidak valid: kapasitas harus lebih dari 0')
    Object.assign(sem, {
      slot: Number(body.slot) || 1, room: body.room.trim(), title: body.title.trim(),
      speaker: body.speaker || '', capacity: Number(body.capacity),
    })
    save(s)
    return delay({ status: 'updated' })
  },

  deleteSeminar(id) {
    const s = load()
    if (!s.seminars.some((x) => x.id === Number(id))) return fail(404, 'data tidak ditemukan')
    s.seminars = s.seminars.filter((x) => x.id !== Number(id))
    s.registrations = s.registrations.filter((r) => r.seminar_id !== Number(id))
    save(s)
    return delay({ status: 'deleted' })
  },

  seminarDetail(id) {
    const s = load()
    const sem = s.seminars.find((x) => x.id === Number(id))
    if (!sem) return fail(404, 'data tidak ditemukan')
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
    const errors = []
    rows.forEach((row, i) => {
      try {
        createMemberRow(s, row)
        created++
      } catch (e) {
        errors.push({ row: i + 1, label: row.email || row.name || '?', error: e.message })
      }
    })
    save(s)
    return delay({ created, failed: errors.length, errors })
  },

  bulkTenants(rows) {
    const s = load()
    let created = 0
    const errors = []
    rows.forEach((row, i) => {
      try {
        createTenantRow(s, row)
        created++
      } catch (e) {
        errors.push({ row: i + 1, label: row.name || '?', error: e.message })
      }
    })
    save(s)
    return delay({ created, failed: errors.length, errors })
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
