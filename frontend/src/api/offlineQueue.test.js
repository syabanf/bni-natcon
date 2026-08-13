// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueueScan, flushQueue, getQueue } from './offlineQueue'

class ApiError extends Error {
  constructor(status) {
    super(`status ${status}`)
    this.status = status
  }
}

beforeEach(() => localStorage.clear())

describe('offline scan queue', () => {
  it('keeps scans while the booth is offline', async () => {
    enqueueScan('NATCON-2026-00001')
    enqueueScan('NATCON-2026-00002')
    const scan = vi.fn(() => Promise.reject(new ApiError(0)))

    const res = await flushQueue(scan)

    expect(res).toEqual({ synced: 0, remaining: 2 })
    expect(getQueue()).toHaveLength(2)
  })

  it('clears the queue once the scans go through', async () => {
    enqueueScan('NATCON-2026-00001')
    enqueueScan('NATCON-2026-00002')

    const res = await flushQueue(vi.fn(() => Promise.resolve({})))

    expect(res).toEqual({ synced: 2, remaining: 0 })
    expect(getQueue()).toHaveLength(0)
  })

  // A queued scan is a visit that really happened at the booth. It may only
  // be dropped when the server says this code will never work.
  it.each([
    ['session expired', 401],
    ['rate limited', 429],
    ['request timeout', 408],
    ['server error', 500],
    ['bad gateway', 502],
  ])('holds on to a scan when the failure is temporary: %s', async (_label, status) => {
    enqueueScan('NATCON-2026-00001')

    const res = await flushQueue(vi.fn(() => Promise.reject(new ApiError(status))))

    expect(res.remaining).toBe(1)
    expect(getQueue()[0].member_code).toBe('NATCON-2026-00001')
  })

  it.each([
    ['unknown member code', 404],
    ['already scanned here', 409],
    ['malformed code', 400],
  ])('drops a scan the server will never accept: %s', async (_label, status) => {
    enqueueScan('NOT-A-CODE')

    const res = await flushQueue(vi.fn(() => Promise.reject(new ApiError(status))))

    expect(res.remaining).toBe(0)
    expect(getQueue()).toHaveLength(0)
  })

  it('syncs what it can and keeps only what failed', async () => {
    enqueueScan('good-1')
    enqueueScan('expired-session')
    enqueueScan('good-2')
    const scan = vi.fn((code) =>
      code === 'expired-session' ? Promise.reject(new ApiError(401)) : Promise.resolve({}),
    )

    const res = await flushQueue(scan)

    expect(res).toEqual({ synced: 2, remaining: 1 })
    expect(getQueue().map((q) => q.member_code)).toEqual(['expired-session'])
  })

  it('survives a corrupted queue in localStorage', () => {
    localStorage.setItem('natcon-scan-queue', 'not json')
    expect(getQueue()).toEqual([])
  })
})
