/*
 * Shrink a photo before it is uploaded.
 *
 * A cover is drawn about 800 px wide and a speaker portrait smaller still,
 * but a phone takes 4032 px photos weighing 3–5 MB. Sending the original
 * means the committee waits on the upload — 5 s on 4G, half a minute on a
 * busy venue WiFi — and then every attendee downloads that same file to look
 * at a card the size of a thumbnail. The server never was the slow part: it
 * answers in about 10 ms whatever the size.
 *
 * So: draw the picture into a canvas at a sane size and re-encode it. A 4 MB
 * photo lands around 200–400 KB with no visible difference at the size it is
 * displayed.
 *
 * Anything that cannot be decoded here is passed through untouched and the
 * API decides — that is what keeps this safe on browsers that cannot read
 * HEIC. On Safari, which can, this step quietly converts an iPhone photo to
 * JPEG and the upload simply works.
 */

export const MAX_EDGE = 1600
export const JPEG_QUALITY = 0.82
// Below this, re-encoding costs more than it saves.
export const SKIP_UNDER_BYTES = 400 * 1024

// PNG and GIF can carry transparency; re-encoding those to JPEG would fill it
// with black. They stay in their own format, which still shrinks when the
// picture is scaled down.
const KEEPS_ALPHA = new Set(['image/png', 'image/gif'])

const canDecodeInBrowser = () =>
  typeof document !== 'undefined' &&
  typeof createImageBitmap === 'function' &&
  typeof HTMLCanvasElement !== 'undefined' &&
  typeof HTMLCanvasElement.prototype.toBlob === 'function'

/**
 * Returns a File no larger than needed — or the original when it is already
 * small, or when this browser cannot decode it.
 */
export async function shrinkForUpload(file, { maxEdge = MAX_EDGE } = {}) {
  if (!file || file.size <= SKIP_UNDER_BYTES) return file
  if (!canDecodeInBrowser()) return file

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file // HEIC on Chrome, a corrupt file, a PDF someone renamed
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const type = KEEPS_ALPHA.has(file.type) ? file.type : 'image/jpeg'
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY))
  // A re-encode that came out bigger is not worth keeping — small graphics
  // and screenshots can do that.
  if (!blob || blob.size >= file.size) return file

  return new File([blob], renameFor(file.name, type), {
    type,
    lastModified: file.lastModified ?? Date.now(),
  })
}

// photo.HEIC re-encoded as JPEG has to stop calling itself .HEIC.
export function renameFor(name, type) {
  const ext = type === 'image/png' ? '.png' : type === 'image/gif' ? '.gif' : '.jpg'
  const base = (name || 'image').replace(/\.[^.]+$/, '')
  return base + ext
}
