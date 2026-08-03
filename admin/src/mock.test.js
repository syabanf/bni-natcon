import { beforeEach, describe, expect, it } from 'vitest'

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

const { mockAdminApi } = await import('./mock')

beforeEach(() => {
  localStorage.clear()
})

describe('overview & seed', () => {
  it('angka overview sesuai data seed', async () => {
    const o = await mockAdminApi.overview()
    expect(o.total_members).toBe(8)
    expect(o.total_tenants).toBe(14)
    expect(o.total_visits).toBe(12)
    expect(o.seminar_registrations).toBe(4)
  })
})

describe('pagination & pencarian peserta', () => {
  it('memotong per halaman dan memfilter q', async () => {
    const page1 = await mockAdminApi.members({ page: 1, limit: 3 })
    expect(page1.members).toHaveLength(3)
    expect(page1.total).toBe(8)

    const page3 = await mockAdminApi.members({ page: 3, limit: 3 })
    expect(page3.members).toHaveLength(2)

    const found = await mockAdminApi.members({ q: 'reddie' })
    expect(found.total).toBe(1)
    expect(found.members[0].name).toBe('Reddie Wijaya')
  })
})

describe('CRUD peserta', () => {
  it('menolak email duplikat & format salah dengan status yang benar', async () => {
    await mockAdminApi.createMember({ name: 'Baru', email: 'baru@natcon.id' })
    await expect(
      mockAdminApi.createMember({ name: 'Dup', email: 'baru@natcon.id' })
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      mockAdminApi.createMember({ name: 'Bad', email: 'bukan-email' })
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('check-in pintu seminar', () => {
  it('hadir sekali, duplikat terdeteksi, belum-terdaftar ditolak', async () => {
    // Budi (id 4) terdaftar seminar 1 tapi belum hadir di seed.
    const budi = (await mockAdminApi.members({ q: 'budi' })).members[0]

    const first = await mockAdminApi.seminarCheckin(1, budi.member_code)
    expect(first.duplicate).toBe(false)

    const again = await mockAdminApi.seminarCheckin(1, budi.member_code)
    expect(again.duplicate).toBe(true)

    // Agus tidak terdaftar seminar 1.
    const agus = (await mockAdminApi.members({ q: 'agus' })).members[0]
    await expect(mockAdminApi.seminarCheckin(1, agus.member_code)).rejects.toMatchObject({
      status: 409,
    })

    await expect(mockAdminApi.seminarCheckin(1, 'NATCON-2026-00000')).rejects.toMatchObject({
      status: 404,
    })

    const detail = await mockAdminApi.seminarDetail(1)
    // Seed sudah punya 1 kehadiran (Reddie) + Budi barusan.
    expect(detail.seminar.attended_count).toBe(2)
    expect(detail.attendees.find((a) => a.name === 'Budi Hartanto').checked_in).toBe(true)

    const report = await mockAdminApi.registrationReport()
    expect(report.registrations.find((r) => r.member_name === 'Budi Hartanto').attended).toBe(true)
  })
})

describe('hapus tenant ber-cascade', () => {
  it('menghapus tenant ikut menghapus kunjungannya', async () => {
    const before = await mockAdminApi.overview()
    await mockAdminApi.deleteTenant(3) // Kopi Nusantara has 4 seed visits
    const after = await mockAdminApi.overview()
    expect(after.total_tenants).toBe(before.total_tenants - 1)
    expect(after.total_visits).toBe(before.total_visits - 4)
  })
})

describe('bulk import upsert & chapters', () => {
  it('creates then updates by email, and registers chapters', async () => {
    const first = await mockAdminApi.bulkMembers([
      { name: 'Upsert One', email: 'upsert@natcon.id', chapter: 'Chapter Baru', phone: '+62810000001' },
    ])
    expect(first.created).toBe(1)
    expect(first.updated).toBe(0)

    const second = await mockAdminApi.bulkMembers([
      { name: 'Upsert One Renamed', email: 'upsert@natcon.id', chapter: 'Chapter Baru', phone: '+62810000002' },
    ])
    expect(second.created).toBe(0)
    expect(second.updated).toBe(1)

    const found = await mockAdminApi.members({ q: 'upsert@natcon.id' })
    expect(found.total).toBe(1)
    expect(found.members[0].name).toBe('Upsert One Renamed')
    expect(found.members[0].phone).toBe('+62810000002')

    const chapters = await mockAdminApi.chapters()
    const baru = chapters.chapters.find((c) => c.name === 'Chapter Baru')
    expect(baru.members).toBe(1)
  })

  it('rename cascades to members; delete refuses while in use', async () => {
    await mockAdminApi.bulkMembers([
      { name: 'Casc Ade', email: 'casc@natcon.id', chapter: 'Chapter Lama' },
    ])
    const { chapters } = await mockAdminApi.chapters()
    const lama = chapters.find((c) => c.name === 'Chapter Lama')

    await expect(mockAdminApi.deleteChapter(lama.id)).rejects.toMatchObject({ status: 409 })

    await mockAdminApi.renameChapter(lama.id, 'Chapter Hebat')
    const found = await mockAdminApi.members({ q: 'casc@natcon.id' })
    expect(found.members[0].chapter).toBe('Chapter Hebat')
  })
})
