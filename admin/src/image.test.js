// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JPEG_QUALITY, MAX_EDGE, renameFor, shrinkForUpload, SKIP_UNDER_BYTES } from './image'

const file = (name, type, size) =>
  Object.defineProperty(new File(['x'], name, { type }), 'size', { value: size })

// jsdom has no canvas, so the browser side is stubbed to the shape the code
// actually uses: decode, draw, encode.
function stubBrowserImaging({ width, height, encodedSize }) {
  const drawn = []
  globalThis.createImageBitmap = vi.fn(() => Promise.resolve({ width, height, close() {} }))
  const toBlob = vi.fn((cb, type) =>
    cb(Object.defineProperty(new Blob(['y'], { type }), 'size', { value: encodedSize })))
  HTMLCanvasElement.prototype.toBlob = toBlob
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: (_img, _x, _y, w, h) => drawn.push([w, h]),
  }))
  return { drawn, toBlob }
}

afterEach(() => {
  delete globalThis.createImageBitmap
  vi.restoreAllMocks()
})

describe('shrinking a photo before upload', () => {
  it('scales a phone photo down to the long edge and keeps its aspect ratio', async () => {
    const { drawn, toBlob } = stubBrowserImaging({ width: 4032, height: 3024, encodedSize: 300 * 1024 })

    const out = await shrinkForUpload(file('IMG_0042.JPG', 'image/jpeg', 4 << 20))

    expect(drawn).toEqual([[MAX_EDGE, 1200]]) // 4032x3024 -> 1600x1200
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', JPEG_QUALITY)
    // What travels is the re-encoded picture, not what came off the phone.
    expect(out.name).toBe('IMG_0042.jpg')
    expect(out.type).toBe('image/jpeg')
  })

  it('leaves a small file alone — re-encoding would cost more than it saves', async () => {
    stubBrowserImaging({ width: 800, height: 600, encodedSize: 1 })
    const small = file('logo.jpg', 'image/jpeg', SKIP_UNDER_BYTES - 1)

    await expect(shrinkForUpload(small)).resolves.toBe(small)
    expect(globalThis.createImageBitmap).not.toHaveBeenCalled()
  })

  it('does not enlarge a picture that is already smaller than the limit', async () => {
    const { drawn } = stubBrowserImaging({ width: 1000, height: 700, encodedSize: 100 * 1024 })

    await shrinkForUpload(file('poster.jpg', 'image/jpeg', 2 << 20))

    expect(drawn).toEqual([[1000, 700]])
  })

  it('keeps PNG as PNG so transparency does not turn black', async () => {
    const { toBlob } = stubBrowserImaging({ width: 2000, height: 2000, encodedSize: 200 * 1024 })

    const out = await shrinkForUpload(file('mark.png', 'image/png', 3 << 20))

    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png', JPEG_QUALITY)
    expect(out.name).toBe('mark.png')
  })

  it('hands the original back when the browser cannot decode it (HEIC on Chrome)', async () => {
    stubBrowserImaging({ width: 1, height: 1, encodedSize: 1 })
    globalThis.createImageBitmap = vi.fn(() => Promise.reject(new Error('unsupported')))
    const heic = file('IMG_0042.HEIC', 'image/heic', 4 << 20)

    // Untouched: the API then explains what HEIC is and how to convert it.
    await expect(shrinkForUpload(heic)).resolves.toBe(heic)
  })

  it('keeps the original when re-encoding came out bigger', async () => {
    stubBrowserImaging({ width: 1200, height: 900, encodedSize: 9 << 20 })
    const source = file('screenshot.png', 'image/png', 1 << 20)

    await expect(shrinkForUpload(source)).resolves.toBe(source)
  })

  it('renames a converted file so it stops claiming to be HEIC', () => {
    expect(renameFor('IMG_0042.HEIC', 'image/jpeg')).toBe('IMG_0042.jpg')
    expect(renameFor('mark.png', 'image/png')).toBe('mark.png')
    expect(renameFor('no-extension', 'image/jpeg')).toBe('no-extension.jpg')
  })
})
