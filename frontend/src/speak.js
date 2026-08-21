/*
 * Reading the tour out loud.
 *
 * The browser's own speech synthesis, so there is no voice file to download
 * and nothing to pay for — which matters on a venue WiFi with 769 phones on
 * it. Everything here fails quietly: a browser without speech, a phone with
 * no installed voice, or a page that has not been touched yet (some browsers
 * refuse to speak until it has) must not break the tour that carries it.
 */

export const VOICE_OFF_KEY = 'natcon-tour-muted'

const engine = () => (typeof window !== 'undefined' ? window.speechSynthesis : null)

export const speechAvailable = () => !!engine()

export const isMuted = () => {
  try {
    return localStorage.getItem(VOICE_OFF_KEY) === '1'
  } catch {
    return false
  }
}

export const setMuted = (muted) => {
  try {
    localStorage.setItem(VOICE_OFF_KEY, muted ? '1' : '0')
  } catch {
    /* private mode — the choice just does not outlive the session */
  }
  if (muted) stop()
}

export function stop() {
  try {
    engine()?.cancel()
  } catch {
    /* nothing was speaking */
  }
}

/** Speak one passage, replacing whatever was being said. */
export function speak(text, { lang = 'en-US', rate = 0.98 } = {}) {
  const synth = engine()
  if (!synth || !text || isMuted()) return false
  try {
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = rate
    synth.speak(u)
    return true
  } catch {
    return false
  }
}
