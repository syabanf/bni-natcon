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
    phone: '+62811000154', classification: 'IT & Software',
  },
  {
    id: 2, name: 'Sinta Dewi', email: 'sinta@natcon.id', role: 'member',
    member_code: 'NATCON-2026-08201', chapter: 'BNI Chapter Jakarta Elite', company: 'Sinta Florist',
    phone: '+62811000201', classification: 'Trade & Distribution',
  },
  {
    id: 3, name: 'Agus Santoso', email: 'agus@natcon.id', role: 'member',
    member_code: 'NATCON-2026-08322', chapter: 'BNI Chapter Bandung Raya', company: 'Santoso Baja',
    phone: '+62811000322', classification: 'Manufacturing',
  },
]

const TENANTS = [
  { id: 13, name: 'BNI Xpora', category: 'Main Sponsor', booth: 'SP-01', initials: 'BX', kind: 'sponsor', description: "BNI's one-stop export hub — banking solutions for members going global." },
  { id: 14, name: 'Wondr by BNI', category: 'Digital Sponsor', booth: 'SP-02', initials: 'WB', kind: 'sponsor', description: 'Personal finance super-app: payments, savings goals, and lifestyle deals.' },
  { id: 1, name: 'Kopi Nusantara', category: 'F&B', booth: 'A-03', initials: 'KN', kind: 'booth', description: 'Single-origin Indonesian coffee, roasted in-house. Free cupping session at the booth.' },
  { id: 2, name: 'Bank Mitra Sejahtera', category: 'Finance', booth: 'A-05', initials: 'BM', kind: 'booth', description: 'SME lending and cash-management partner for BNI chapter businesses.' },
  { id: 3, name: 'Garuda Print Media', category: 'Printing', booth: 'A-08', initials: 'GP', kind: 'booth', description: 'Large-format printing and event branding with same-day turnaround.' },
  { id: 4, name: 'TechNesia Solutions', category: 'IT & Software', booth: 'B-01', initials: 'TS', kind: 'booth', description: 'Custom software, ERP integrations, and managed cloud for growing teams.' },
  { id: 5, name: 'Sehat Selalu Clinic', category: 'Healthcare', booth: 'B-04', initials: 'SS', kind: 'booth', description: 'Corporate health checks and on-site wellness programs.' },
  { id: 6, name: 'Properti Prima', category: 'Property', booth: 'B-07', initials: 'PP', kind: 'booth', description: 'Commercial property advisory — office, warehouse, and retail spaces.' },
  { id: 7, name: 'Logistik Cepat', category: 'Logistics', booth: 'C-02', initials: 'LC', kind: 'booth', description: 'Nationwide same-day and next-day delivery with live tracking.' },
  { id: 8, name: 'Asuransi Aman', category: 'Insurance', booth: 'C-05', initials: 'AA', kind: 'booth', description: 'Business insurance tailored for SMEs: assets, liability, and health.' },
  { id: 9, name: 'Kreasi Digital', category: 'Marketing', booth: 'C-08', initials: 'KD', kind: 'booth', description: 'Performance marketing and brand studios for ambitious businesses.' },
  { id: 10, name: 'Hukum & Rekan', category: 'Legal', booth: 'D-01', initials: 'HR', kind: 'booth', description: 'Corporate legal counsel: contracts, compliance, and dispute resolution.' },
  { id: 11, name: 'EduPro Training', category: 'Training', booth: 'D-04', initials: 'EP', kind: 'booth', description: 'Certified professional training for sales, leadership, and finance.' },
  { id: 12, name: 'Katering Rasa', category: 'F&B', booth: 'D-06', initials: 'KR', kind: 'booth', description: 'Premium event catering with authentic archipelago menus.' },
]

const SEMINARS = [
  {
    id: 1, slot: 1, room: 'Breakout Room 1', capacity: 60,
    title: 'Navigating the Mid-Market HR Squeeze: Talent, AI, and Wellbeing in 2026',
    speaker: 'Flavia N. Sungkit, M.Psi., Psikolog — HR Consultant, Ikigai',
    moderator: 'Roby Oktober',
    speakers: [
      { name: 'Flavia N. Sungkit, M.Psi., Psikolog', role: 'speaker', title: 'HR Consultant · Ikigai', photo_url: '/speakers/flavia-sungkit.jpg' },
      { name: 'Roby Oktober', role: 'moderator', title: '', photo_url: '/speakers/roby-oktober.jpg' },
    ],
    cover_url: '',
    description:
      'Mid-sized companies have outgrown startup-style HR but lack enterprise budgets. A strategic roadmap for 2026: pivoting to skills-based management against high-potential turnover, setting boundaries for agentic AI in HR, treating burnout as a boardroom hazard through workflow redesign, and handling the compliance minefield without an internal legal team.',
  },
  {
    id: 2, slot: 1, room: 'Breakout Room 2', capacity: 60,
    title: 'Work-Life Balance & AI: The New Agency Equation',
    speaker: 'Viktor Iwan; Irfan Arsandi — WIT Indonesia',
    moderator: 'Ryan Kristomulyono',
    speakers: [
      { name: 'Viktor Iwan', role: 'speaker', title: '', photo_url: '/speakers/viktor-iwan.jpg' },
      { name: 'Irfan Arsandi', role: 'speaker', title: 'IT & Digital Transformation Consultant · WIT Indonesia', photo_url: '/speakers/irfan-arsandi.jpg' },
      { name: 'Ryan Kristomulyono', role: 'moderator', title: '', photo_url: '/speakers/ryan-kristomulyono.jpg' },
    ],
    cover_url: '',
    description:
      'AI is already in the stack — the question is how it changes the way we measure work. Moving from hours logged to outcome-based performance, the expansion of human agency as AI takes over execution, why 86% of advanced users treat AI output as a starting point, and using AI as a shield for work-life balance rather than a demand for 24/7 productivity.',
  },
  {
    id: 3, slot: 1, room: 'Breakout Room 3', capacity: 60,
    title: 'How to Win in Retail: The 2026 Economic Reality',
    speaker: 'Ben Wirawan — Torch; Selina Nicole — LEKA',
    moderator: 'David Gan',
    speakers: [
      { name: 'Ben Wirawan', role: 'speaker', title: 'Co-Founder & CEO · Torch', photo_url: '/speakers/ben-wirawan.jpg' },
      { name: 'Selina Nicole', role: 'speaker', title: 'Founder · LEKA', photo_url: '/speakers/selina-nicole.jpg' },
      { name: 'David Gan', role: 'moderator', title: 'CEO & Founder · Arkova Training & Consulting', photo_url: '/speakers/david-gan.jpg' },
    ],
    cover_url: '',
    description:
      'Indonesian shoppers are fatigued by rising costs yet still crave premium experiences. Reading the economic trade-down and value hunting, why retail is a business of feelings when 58% of consumers report daily stress, the continued reign of the physical store, and preparing product data for the rise of agentic commerce.',
  },
  {
    id: 4, slot: 1, room: 'Breakout Room 4', capacity: 60,
    title: 'Your Face Tells a Story',
    speaker: 'Suntoro Suciatmaja',
    moderator: '',
    speakers: [
      { name: 'Suntoro Suciatmaja', role: 'speaker', title: '', photo_url: '/speakers/suntoro-suciatmaja.jpg' },
    ],
    cover_url: '',
    description:
      'Reading faces as a practical business skill — what expression, structure, and first impressions communicate before a word is said, and how to use that in sales conversations, negotiation, and building trust fast.',
  },
]

// Demo company for the "in this room" list, so it isn't empty on a fresh device.
const DEMO_ATTENDEES = {
  1: [
    { name: 'Melly Hartono', chapter: 'Chapter Surabaya One', company: 'Melly Tax', checked_in: true },
    { name: 'Rina Kartika', chapter: 'Chapter Bali Paradise', company: 'Kartika Law', checked_in: false },
  ],
  2: [
    { name: 'Joko Prabowo', chapter: 'Chapter Medan Utama', company: 'JP Otomotif', checked_in: false },
  ],
  3: [
    { name: 'Dedi Firmansyah', chapter: 'Chapter Semarang Jaya', company: 'DF Logistics', checked_in: true },
  ],
}

function boothEmail(tenant) {
  return `booth-${tenant.booth.toLowerCase().replace('-', '')}@natcon.id`
}

// Static demo occupants per table so the networking screen feels alive.
// Fake personas carry email + phone so tel:/mailto: links work in demo.
const FAKE_MATES = {
  12: [
    { id: 'f-sinta12', name: 'Melly Hartono', company: 'Melly Tax · Konsultan Pajak', chapter: 'Chapter Surabaya One', email: 'sinta12@natcon.id', phone: '+62855029300', classification: 'Professional Services' },
    { id: 'f-joko12', name: 'Joko Prabowo', company: 'JP Otomotif · Bengkel Premium', chapter: 'Chapter Medan Utama', email: 'joko12@natcon.id', phone: '+62827973000', classification: 'Automotive' },
    { id: 'f-rina12', name: 'Rina Kartika', company: 'Kartika Law · Notaris', chapter: 'Chapter Bali Paradise', email: 'rina12@natcon.id', phone: '+62885093000', classification: 'Legal' },
    { id: 'f-dedi12', name: 'Dedi Firmansyah', company: 'DF Logistics · Ekspedisi', chapter: 'Chapter Semarang Jaya', email: 'dedi12@natcon.id', phone: '+62807053000', classification: 'Logistics' },
    { id: 'f-lusi12', name: 'Lusi Anggraini', company: 'Lusi Catering · F&B', chapter: 'Chapter Jakarta Elite', email: 'lusi12@natcon.id', phone: '+62869553000', classification: 'Food & Beverage' },
  ],
  5: [
    { id: 'f-budi5', name: 'Budi Hartanto', company: 'Budi Craft Studio', chapter: 'Chapter Yogya Istimewa', email: 'budi5@natcon.id', phone: '+62869051000', classification: 'Creative & Craft' },
    { id: 'f-citra5', name: 'Citra Lestari', company: 'Citra Media', chapter: 'Chapter Tangerang Hebat', email: 'citra5@natcon.id', phone: '+62835289100', classification: 'Media & Marketing' },
  ],
}

function loadState() {
  const defaults = {
    // member_code -> [tenantId]; also drives coupons & booth dashboards
    visits: {},
    // member_code -> { [slot]: seminarId }
    registrations: {},
    // tenantId -> [{ code, at }]
    scans: {},
    // member_code -> tableNo
    seats: {},
    // member_code -> [contact ids]
    contacts: {},
    // member_code -> [{ table_no, hall, at }]
    tableHistory: {},
    // member_code -> { contactId: iso }
    contactTimes: {},
    // member_code -> { contactId: note }
    contactNotes: {},
    // tenantId -> { member_code: note }
    visitorNotes: {},
  }
  try {
    const raw = localStorage.getItem(STATE_KEY)
    // Merge so states saved by older app versions gain new fields.
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {
    /* corrupt state falls through to fresh */
  }
  return defaults
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
    return fail(401, 'Demo mode: use a demo account (reddie@, sinta@, agus@, booth-a03@, booth-sp01@ …)')
  },

  restore(user) {
    currentUser = user
  },

  me() {
    if (!currentUser) return fail(401, 'Not signed in')
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
        attended: Boolean((state.attendance || {})[`${currentUser?.member_code}:${s.id}`]),
      })),
    })
  },

  // Who else is in the room: whoever this device has registered, plus a
  // couple of demo attendees so the list is never empty.
  seminarAttendees(id) {
    const state = loadState()
    const semID = Number(id)
    const out = []
    for (const [code, slots] of Object.entries(state.registrations || {})) {
      if (!Object.values(slots || {}).includes(semID)) continue
      const m = MOCK_MEMBERS.find((x) => x.member_code === code)
      out.push({
        name: m?.name || code,
        chapter: m?.chapter || '',
        company: m?.company || '',
        checked_in: Boolean((state.attendance || {})[`${code}:${semID}`]),
      })
    }
    for (const p of DEMO_ATTENDEES[semID] || []) out.push(p)
    return delay({ attendees: out })
  },

  registerSeminar(id) {
    const seminar = SEMINARS.find((s) => s.id === Number(id))
    if (!seminar) return fail(404, 'data not found')
    const state = loadState()
    const code = currentUser.member_code
    const regs = state.registrations[code] || {}
    if (regs[seminar.slot]) {
      return fail(409, 'you are already registered for another seminar in this slot')
    }
    if (seatsTaken(state, seminar.id) >= seminar.capacity) {
      return fail(409, 'this seminar is fully booked — please pick another session')
    }
    regs[seminar.slot] = seminar.id
    state.registrations[code] = regs
    saveState(state)
    return delay({ status: 'registered' })
  },

  unregisterSeminar(id) {
    const seminar = SEMINARS.find((s) => s.id === Number(id))
    if (!seminar) return fail(404, 'data not found')
    const state = loadState()
    const regs = state.registrations[currentUser.member_code] || {}
    if (regs[seminar.slot] !== seminar.id) return fail(404, 'data not found')
    delete regs[seminar.slot]
    saveState(state)
    return delay({ status: 'unregistered' })
  },

  scan(memberKey) {
    const key = String(memberKey).trim()
    const member = memberByCode(key) || MOCK_MEMBERS.find((m) => m.phone === key)
    if (!member) return fail(404, 'data not found')
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
      member_id: member.member_code,
      member_name: member.name,
      member_chapter: member.chapter,
      member_company: member.company,
      duplicate,
      coupons: (state.visits[member.member_code] || []).length,
    })
  },

  /* ----- Speed networking ----- */

  networking() {
    const state = loadState()
    const myCode = currentUser?.member_code
    const tableOf = (n) => ({
      fake: FAKE_MATES[n] || [],
      real: MOCK_MEMBERS.filter((m) => state.seats[m.member_code] === n),
    })
    const tables = Array.from({ length: 12 }, (_, i) => {
      const n = i + 1
      const { fake, real } = tableOf(n)
      return { table_no: n, hall: 'Hall B', capacity: 8, occupied: fake.length + real.length }
    })

    const myTable = state.seats[myCode]
    if (!myTable) return delay({ checked_in: false, tables })

    const { fake, real } = tableOf(myTable)
    const savedSet = new Set(state.contacts[myCode] || [])
    const notes = state.contactNotes[myCode] || {}
    let seat = 0
    const mates = [
      ...real.map((m) => ({
        member_id: m.member_code, name: m.name, chapter: m.chapter, company: m.company,
        classification: m.classification || '', phone: m.phone || '',
        seat_no: ++seat, is_me: m.member_code === myCode, saved: savedSet.has(m.member_code),
        note: notes[m.member_code] || '',
      })),
      ...fake.map((f) => ({
        member_id: f.id, name: f.name, chapter: f.chapter, company: f.company,
        classification: f.classification || '', phone: f.phone || '',
        seat_no: ++seat, is_me: false, saved: savedSet.has(f.id),
        note: notes[f.id] || '',
      })),
    ]
    return delay({
      checked_in: true,
      tables,
      table: tables[myTable - 1],
      seat_no: mates.find((m) => m.is_me)?.seat_no || 1,
      mates,
    })
  },

  networkingCheckIn(tableNo) {
    const n = Number(tableNo)
    if (!n || n < 1 || n > 12) return fail(404, 'data not found')
    const state = loadState()
    const fake = (FAKE_MATES[n] || []).length
    const real = MOCK_MEMBERS.filter(
      (m) => state.seats[m.member_code] === n && m.member_code !== currentUser.member_code
    ).length
    if (fake + real >= 8) return fail(409, 'this table is full — please join another one')
    state.seats[currentUser.member_code] = n
    const history = state.tableHistory[currentUser.member_code] || []
    history.unshift({ table_no: n, hall: 'Hall B', at: new Date().toISOString() })
    state.tableHistory[currentUser.member_code] = history
    saveState(state)
    return delay({ status: 'checked_in' })
  },

  saveContact(contactID) {
    const state = loadState()
    const myCode = currentUser.member_code
    const contacts = state.contacts[myCode] || []
    if (!contacts.includes(contactID)) {
      contacts.push(contactID)
      const times = state.contactTimes[myCode] || {}
      times[contactID] = new Date().toISOString()
      state.contactTimes[myCode] = times
    }
    state.contacts[myCode] = contacts
    saveState(state)
    return delay({ status: 'saved' })
  },

  saveAllContacts() {
    const state = loadState()
    const myCode = currentUser.member_code
    const n = state.seats[myCode]
    if (!n) return fail(404, 'data not found')
    const contacts = new Set(state.contacts[myCode] || [])
    const times = state.contactTimes[myCode] || {}
    const addAt = (id) => {
      if (!contacts.has(id)) times[id] = new Date().toISOString()
      contacts.add(id)
    }
    for (const f of FAKE_MATES[n] || []) addAt(f.id)
    for (const m of MOCK_MEMBERS) {
      if (state.seats[m.member_code] === n && m.member_code !== myCode) addAt(m.member_code)
    }
    state.contacts[myCode] = [...contacts]
    state.contactTimes[myCode] = times
    saveState(state)
    return delay({ status: 'saved', saved: contacts.size })
  },

  networkingHistory() {
    const state = loadState()
    const myCode = currentUser?.member_code
    const allFakes = Object.values(FAKE_MATES).flat()
    const resolve = (id) =>
      MOCK_MEMBERS.find((m) => m.member_code === id) || allFakes.find((f) => f.id === id)
    const times = state.contactTimes[myCode] || {}
    const contacts = (state.contacts[myCode] || [])
      .map((id) => {
        const p = resolve(id)
        return p
          ? {
              member_id: id,
              name: p.name,
              chapter: p.chapter || '',
              company: p.company || '',
              member_code: p.member_code || '',
              note: (state.contactNotes[myCode] || {})[id] || '',
              saved_at: times[id] || null,
            }
          : null
      })
      .filter(Boolean)
      .reverse()
    return delay({
      tables: (state.tableHistory[myCode] || []).map((t) => ({
        table_no: t.table_no,
        hall: t.hall,
        joined_at: t.at,
      })),
      contacts,
    })
  },

  networkingTableDetail(tableNo) {
    const n = Number(tableNo)
    if (!n || n < 1 || n > 12) return fail(404, 'data not found')
    const state = loadState()
    const myCode = currentUser?.member_code
    const savedSet = new Set(state.contacts[myCode] || [])
    let seat = 0
    const members = [
      ...MOCK_MEMBERS.filter((m) => state.seats[m.member_code] === n).map((m) => ({
        member_id: m.member_code, name: m.name, chapter: m.chapter, company: m.company,
        classification: m.classification || '', phone: m.phone || '',
        seat_no: ++seat, is_me: m.member_code === myCode, saved: savedSet.has(m.member_code),
      })),
      ...(FAKE_MATES[n] || []).map((f) => ({
        member_id: f.id, name: f.name, chapter: f.chapter, company: f.company,
        classification: f.classification || '', phone: f.phone || '',
        seat_no: ++seat, is_me: false, saved: savedSet.has(f.id),
      })),
    ]
    return delay({
      table: { table_no: n, hall: 'Hall B', capacity: 8, occupied: members.length },
      members,
    })
  },

  networkingContactDetail(id) {
    const state = loadState()
    const myCode = currentUser?.member_code
    if (!(state.contacts[myCode] || []).includes(id)) return fail(404, 'data not found')
    const allFakes = Object.values(FAKE_MATES).flat()
    const person =
      MOCK_MEMBERS.find((m) => m.member_code === id) || allFakes.find((f) => f.id === id)
    if (!person) return fail(404, 'data not found')
    // Fake personas "sit" at their home table; real members use live seats.
    let currentTable = 0
    const fakeHome = Object.entries(FAKE_MATES).find(([, list]) => list.some((f) => f.id === id))
    if (fakeHome) currentTable = Number(fakeHome[0])
    if (person.member_code && state.seats[person.member_code]) {
      currentTable = state.seats[person.member_code]
    }
    return delay({
      member_id: id,
      name: person.name,
      chapter: person.chapter || '',
      company: person.company || '',
      classification: person.classification || '',
      member_code: person.member_code || '',
      email: person.email || '',
      phone: person.phone || '',
      note: (state.contactNotes[myCode] || {})[id] || '',
      saved_at: (state.contactTimes[myCode] || {})[id] || null,
      current_table_no: currentTable,
    })
  },

  setContactNote(id, note) {
    const state = loadState()
    const myCode = currentUser?.member_code
    if (!(state.contacts[myCode] || []).includes(id)) return fail(404, 'data not found')
    const notes = state.contactNotes[myCode] || {}
    notes[id] = note
    state.contactNotes[myCode] = notes
    saveState(state)
    return delay({ status: 'saved' })
  },

  booth() {
    const t = TENANTS.find((x) => x.id === currentUser?.tenantId)
    if (!t) return fail(404, 'data not found')
    return delay({
      id: t.id, name: t.name, category: t.category, booth: t.booth,
      initials: t.initials, kind: t.kind, description: t.description,
    })
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
    const notes = state.visitorNotes[currentUser?.tenantId] || {}
    const scans = (state.scans[currentUser?.tenantId] || []).slice(0, limit)
    return delay({
      visitors: scans.map((s) => {
        const m = memberByCode(s.code)
        return {
          member_id: s.code, name: m?.name || s.code, chapter: m?.chapter || '',
          company: m?.company || '', member_code: s.code, phone: m?.phone || '',
          note: notes[s.code] || '', visited_at: s.at,
        }
      }),
    })
  },

  visitorDetail(memberId) {
    const state = loadState()
    const scans = state.scans[currentUser?.tenantId] || []
    const scan = scans.find((s) => s.code === memberId)
    if (!scan) return fail(404, 'data not found')
    const m = memberByCode(scan.code)
    const notes = state.visitorNotes[currentUser?.tenantId] || {}
    return delay({
      visitor: {
        member_id: scan.code, name: m?.name || scan.code, chapter: m?.chapter || '',
        company: m?.company || '', member_code: scan.code, phone: m?.phone || '',
        note: notes[scan.code] || '', visited_at: scan.at,
      },
    })
  },

  setVisitorNote(memberId, note) {
    const state = loadState()
    const scans = state.scans[currentUser?.tenantId] || []
    if (!scans.some((s) => s.code === memberId)) return fail(404, 'data not found')
    const notes = state.visitorNotes[currentUser?.tenantId] || {}
    notes[memberId] = note
    state.visitorNotes[currentUser?.tenantId] = notes
    saveState(state)
    return delay({ status: 'saved' })
  },
}
