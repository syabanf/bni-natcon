import { beforeEach, describe, expect, it } from 'vitest'

// Stub localStorage (mock layer berjalan penuh dari localStorage).
class MemStorage {
  constructor() {
    this.store = {}
  }
  getItem(k) {
    return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null
  }
  setItem(k, v) {
    this.store[k] = String(v)
  }
  removeItem(k) {
    delete this.store[k]
  }
  clear() {
    this.store = {}
  }
}
globalThis.localStorage = new MemStorage()

const { mockApi } = await import('./mock')

const REDDIE = 'reddie@natcon.id'
const BOOTH = 'booth-a03@natcon.id'
const REDDIE_CODE = 'NATCON-2026-08154'

beforeEach(() => {
  localStorage.clear()
})

describe('mock login', () => {
  it('menerima persona member & tenant, menolak email asing', async () => {
    const m = await mockApi.login(REDDIE)
    expect(m.user.role).toBe('member')
    expect(m.user.member_code).toBe(REDDIE_CODE)

    const t = await mockApi.login(BOOTH)
    expect(t.user.role).toBe('tenant')

    await expect(mockApi.login('asing@example.com')).rejects.toMatchObject({ status: 401 })
  })
})

describe('alur scan booth (digital stamp)', () => {
  it('scan pertama +1 kupon, scan ulang duplikat, dan tercermin di passport member', async () => {
    await mockApi.login(BOOTH)
    const first = await mockApi.scan(REDDIE_CODE)
    expect(first.duplicate).toBe(false)
    expect(first.coupons).toBe(1)

    const second = await mockApi.scan(REDDIE_CODE)
    expect(second.duplicate).toBe(true)
    expect(second.coupons).toBe(1)

    await expect(mockApi.scan('NATCON-2026-99999')).rejects.toMatchObject({ status: 404 })

    const stats = await mockApi.boothStats()
    expect(stats.total_scans).toBe(1)

    // Persona lain di perangkat yang sama melihat hasil scan tsb.
    await mockApi.login(REDDIE)
    const me = await mockApi.me()
    expect(me.stats.coupons).toBe(1)
    const tenants = await mockApi.tenants()
    expect(tenants.tenants.find((t) => t.booth === 'A-03').visited).toBe(true)
  })
})

describe('aturan seminar', () => {
  it('kunci satu-per-slot, batal, lalu pindah sesi', async () => {
    await mockApi.login(REDDIE)

    await mockApi.registerSeminar(1)
    let list = await mockApi.seminars()
    expect(list.seminars.find((s) => s.id === 1).registered).toBe(true)
    expect(list.seminars.find((s) => s.id === 1).seats_left).toBe(59)

    await expect(mockApi.registerSeminar(2)).rejects.toMatchObject({ status: 409 })

    await mockApi.unregisterSeminar(1)
    await expect(mockApi.unregisterSeminar(1)).rejects.toMatchObject({ status: 404 })

    await mockApi.registerSeminar(2)
    list = await mockApi.seminars()
    expect(list.seminars.find((s) => s.id === 2).registered).toBe(true)
    expect(list.seminars.find((s) => s.id === 1).registered).toBe(false)
  })
})

describe('speed networking', () => {
  it('check-in, mates, simpan kontak, riwayat, dan detail', async () => {
    await mockApi.login(REDDIE)

    let status = await mockApi.networking()
    expect(status.checked_in).toBe(false)
    expect(status.tables).toHaveLength(12)

    await expect(mockApi.networkingCheckIn(99)).rejects.toMatchObject({ status: 404 })

    await mockApi.networkingCheckIn(5) // meja 5 punya 2 penghuni demo
    status = await mockApi.networking()
    expect(status.checked_in).toBe(true)
    expect(status.table.table_no).toBe(5)
    expect(status.mates).toHaveLength(3) // saya + 2 persona demo

    const mate = status.mates.find((m) => !m.is_me)
    await mockApi.saveContact(mate.member_id)

    const history = await mockApi.networkingHistory()
    expect(history.tables[0].table_no).toBe(5)
    expect(history.contacts).toHaveLength(1)
    expect(history.contacts[0].name).toBe(mate.name)

    const detail = await mockApi.networkingTableDetail(5)
    expect(detail.members).toHaveLength(3)
    expect(detail.members.find((m) => m.member_id === mate.member_id).saved).toBe(true)

    const contact = await mockApi.networkingContactDetail(mate.member_id)
    expect(contact.name).toBe(mate.name)
    expect(contact.current_table_no).toBe(5)
  })
})
