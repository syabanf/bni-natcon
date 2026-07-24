/*
 * Demo mock mode: the whole member+tenant app runs from localStorage,
 * no backend needed. Same response shapes as the real API, and shared
 * state — a booth scan as tenant shows up in that member's passport.
 */

const STATE_KEY = 'natcon-mock-state'

export const MOCK_MEMBERS = [
  {
    id: 1, name: 'Reddie Wijaya', email: 'reddie@natcon.id', role: 'member',
    member_code: 'NATCON-2026-08154', chapter: 'BNI Chapter Jakarta Elite', company: 'Witid Intelligence',
  },
  {
    id: 2, name: 'Sinta Dewi', email: 'sinta@natcon.id', role: 'member',
    member_code: 'NATCON-2026-08201', chapter: 'BNI Chapter Jakarta Elite', company: 'Sinta Florist',
  },
  {
    id: 3, name: 'Agus Santoso', email: 'agus@natcon.id', role: 'member',
    member_code: 'NATCON-2026-08322', chapter: 'BNI Chapter Bandung Raya', company: 'Santoso Baja',
  },
]

const TENANTS = [
  { id: 1, name: 'Kopi Nusantara', category: 'F&B', booth: 'A-03', initials: 'KN' },
  { id: 2, name: 'Bank Mitra Sejahtera', category: 'Finansial', booth: 'A-05', initials: 'BM' },
  { id: 3, name: 'Garuda Print Media', category: 'Percetakan', booth: 'A-08', initials: 'GP' },
  { id: 4, name: 'TechNesia Solutions', category: 'IT & Software', booth: 'B-01', initials: 'TS' },
  { id: 5, name: 'Sehat Selalu Clinic', category: 'Kesehatan', booth: 'B-04', initials: 'SS' },
  { id: 6, name: 'Properti Prima', category: 'Properti', booth: 'B-07', initials: 'PP' },
  { id: 7, name: 'Logistik Cepat', category: 'Logistik', booth: 'C-02', initials: 'LC' },
  { id: 8, name: 'Asuransi Aman', category: 'Asuransi', booth: 'C-05', initials: 'AA' },
  { id: 9, name: 'Kreasi Digital', category: 'Marketing', booth: 'C-08', initials: 'KD' },
  { id: 10, name: 'Hukum & Rekan', category: 'Legal', booth: 'D-01', initials: 'HR' },
  { id: 11, name: 'EduPro Training', category: 'Pelatihan', booth: 'D-04', initials: 'EP' },
  { id: 12, name: 'Katering Rasa', category: 'F&B', booth: 'D-06', initials: 'KR' },
]

const SEMINARS = [
  {
    id: 1, slot: 1, room: 'R. Merapi', capacity: 60,
    title: 'Scaling Referral: Dari Chapter ke Nasional',
    speaker: 'Ir. Bambang Wicaksono — National Director',
  },
  {
    id: 2, slot: 1, room: 'R. Rinjani', capacity: 40,
    title: 'AI untuk UKM: Praktis, Bukan Hype',
    speaker: 'Dr. Sarah Kusuma — Witid Intelligence',
  },
]

function boothEmail(tenant) {
  return `booth-${tenant.booth.toLowerCase().replace('-', '')}@natcon.id`
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* corrupt state falls through to fresh */
  }
  return {
    // member_code -> [tenantId]; also drives coupons & booth dashboards
    visits: {},
    // member_code -> { [slot]: seminarId }
    registrations: {},
    // tenantId -> [{ code, at }]
    scans: {},
  }
}

function saveState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state))
}

let currentUser = null

function delay(result) {
  return new Promise((resolve) => setTimeout(() => resolve(result), 150))
}

function fail(status, message) {
  const err = new Error(message)
  err.status = status
  return Promise.reject(err)
}

function memberByCode(code) {
  return MOCK_MEMBERS.find((m) => m.member_code === code)
}

function seatsTaken(state, seminarId) {
  return Object.values(state.registrations).filter((slots) =>
    Object.values(slots || {}).includes(seminarId)
  ).length
}

export const mockApi = {
  login(email) {
    const normalized = email.trim().toLowerCase()
    const member = MOCK_MEMBERS.find((m) => m.email === normalized)
    if (member) {
      currentUser = member
      return delay({ token: 'mock-token', user: member })
    }
    const tenant = TENANTS.find((t) => boothEmail(t) === normalized)
    if (tenant) {
      currentUser = {
        id: 100 + tenant.id, name: tenant.name, email: normalized,
        role: 'tenant', company: tenant.name, tenantId: tenant.id,
      }
      return delay({ token: 'mock-token', user: currentUser })
    }
    return fail(401, 'Mode demo: pakai akun demo (reddie@, sinta@, agus@, booth-a03@ dst)')
  },

  restore(user) {
    currentUser = user
  },

  me() {
    if (!currentUser) return fail(401, 'Belum login')
    if (currentUser.role !== 'member') return delay({ user: currentUser })
    const state = loadState()
    const visited = (state.visits[currentUser.member_code] || []).length
    const regs = state.registrations[currentUser.member_code] || {}
    return delay({
      user: currentUser,
      stats: {
        tenants_visited: visited,
        tenants_total: TENANTS.length,
        coupons: visited,
        seminars_picked: Object.values(regs).filter(Boolean).length,
        seminars_total: 1,
      },
    })
  },

  tenants() {
    const state = loadState()
    const visited = new Set(state.visits[currentUser?.member_code] || [])
    return delay({
      tenants: TENANTS.map((t) => ({ ...t, visited: visited.has(t.id) })),
    })
  },

  seminars() {
    const state = loadState()
    const regs = state.registrations[currentUser?.member_code] || {}
    return delay({
      seminars: SEMINARS.map((s) => ({
        ...s,
        seats_left: s.capacity - seatsTaken(state, s.id),
        registered: regs[s.slot] === s.id,
      })),
    })
  },

  registerSeminar(id) {
    const seminar = SEMINARS.find((s) => s.id === Number(id))
    if (!seminar) return fail(404, 'not found')
    const state = loadState()
    const code = currentUser.member_code
    const regs = state.registrations[code] || {}
    if (regs[seminar.slot]) {
      return fail(409, 'already registered for a seminar in this slot')
    }
    if (seatsTaken(state, seminar.id) >= seminar.capacity) {
      return fail(409, 'seminar is full')
    }
    regs[seminar.slot] = seminar.id
    state.registrations[code] = regs
    saveState(state)
    return delay({ status: 'registered' })
  },

  unregisterSeminar(id) {
    const seminar = SEMINARS.find((s) => s.id === Number(id))
    if (!seminar) return fail(404, 'not found')
    const state = loadState()
    const regs = state.registrations[currentUser.member_code] || {}
    if (regs[seminar.slot] !== seminar.id) return fail(404, 'not found')
    delete regs[seminar.slot]
    saveState(state)
    return delay({ status: 'unregistered' })
  },

  scan(memberCode) {
    const member = memberByCode(memberCode.trim())
    if (!member) return fail(404, 'not found')
    const state = loadState()
    const tenantId = currentUser.tenantId
    const visits = state.visits[member.member_code] || []
    const duplicate = visits.includes(tenantId)
    if (!duplicate) {
      visits.push(tenantId)
      state.visits[member.member_code] = visits
      const scans = state.scans[tenantId] || []
      scans.unshift({ code: member.member_code, at: new Date().toISOString() })
      state.scans[tenantId] = scans
      saveState(state)
    }
    return delay({
      member_name: member.name,
      member_chapter: member.chapter,
      member_company: member.company,
      duplicate,
      coupons: (state.visits[member.member_code] || []).length,
    })
  },

  booth() {
    const t = TENANTS.find((x) => x.id === currentUser?.tenantId)
    if (!t) return fail(404, 'not found')
    return delay({ id: t.id, name: t.name, category: t.category, booth: t.booth, initials: t.initials })
  },

  boothStats() {
    const state = loadState()
    const scans = state.scans[currentUser?.tenantId] || []
    const today = new Date().toDateString()
    return delay({
      total_scans: scans.length,
      scans_today: scans.filter((s) => new Date(s.at).toDateString() === today).length,
    })
  },

  boothVisitors(limit = 10) {
    const state = loadState()
    const scans = (state.scans[currentUser?.tenantId] || []).slice(0, limit)
    return delay({
      visitors: scans.map((s) => {
        const m = memberByCode(s.code)
        return { name: m?.name || s.code, chapter: m?.chapter || '', company: m?.company || '', visited_at: s.at }
      }),
    })
  },
}
