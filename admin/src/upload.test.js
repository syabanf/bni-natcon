import { describe, expect, it, vi } from 'vitest'
import { api, MAX_UPLOAD_BYTES, setToken } from './api'

const fakeFile = (bytes) => ({ size: bytes, name: 'cover.jpg', type: 'image/jpeg' })

describe('cover / speaker photo upload', () => {
  it('refuses an oversized image before it is ever sent', async () => {
    setToken('t')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await expect(api.uploadImage(fakeFile(MAX_UPLOAD_BYTES + 1))).rejects.toMatchObject({
      status: 413,
      // The committee is told the size and the limit, not a gateway code.
      message: expect.stringContaining('5 MB'),
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('names the real cause when a proxy cuts the body off (413/502/504)', async () => {
    setToken('t')
    for (const status of [413, 502, 504]) {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false, status, json: () => Promise.resolve(null),
      })
      await expect(api.uploadImage(fakeFile(1024))).rejects.toMatchObject({
        message: expect.stringContaining('too large'),
      })
    }
  })

  it('passes a normal photo straight through', async () => {
    setToken('t')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 201, json: () => Promise.resolve({ url: '/uploads/abc.jpg' }),
    })
    await expect(api.uploadImage(fakeFile(2 << 20))).resolves.toEqual({ url: '/uploads/abc.jpg' })
  })

  // The three ceilings have to agree, or the failure moves to whichever is
  // lowest and stops being explainable.
  it('agrees with the API and nginx ceilings', () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024)
  })
})
