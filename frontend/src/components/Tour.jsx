import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { useTourStore } from '../store/tour'
import { isMuted, setMuted, speak, speechAvailable, stop } from '../speak'

/*
 * A walk through the attendee app, in one button.
 *
 * 769 people arrive with an app they have never opened, on a day nobody has
 * time to explain it twice. The tour navigates to each tab as it goes, so
 * what the attendee reads is on top of the screen it describes rather than a
 * picture of it, and the tab it is talking about is lit up in the bar below.
 *
 * It opens only when somebody presses Quick tour, next to Log out on every
 * attendee screen. Each step is also read out loud — hands are busy at a
 * registration desk, and a phone held at arm's length is hard to read — with
 * a speaker button to silence it for good.
 */
export const STEPS = [
  {
    path: '/attendee',
    icon: 'home',
    title: 'This is your pass',
    body: 'Your name, chapter and member code are on the card at the top, with the day’s agenda underneath. Everything else is one tap away in the bar at the bottom.',
  },
  {
    path: '/attendee/qr',
    icon: 'qr',
    title: 'Show this QR all day',
    body: 'It carries your ticket number. Booths scan it for a stamp, the desk scans it when they hand you your goodiebag and pin, and the door crew scans it at your learning class.',
  },
  {
    path: '/attendee/passport',
    icon: 'pin',
    title: 'Collect a stamp at every booth',
    body: 'Each booth you visit lights up here. Visiting more of them is what puts you in the lucky draw — the committee sets how many are needed.',
  },
  {
    path: '/attendee/seminar',
    icon: 'mic',
    title: 'Pick your learning classes',
    body: 'You may hold two, as long as they do not run at the same hour. Open the class you picked to find its entry QR, and cancel one to free the seat if you change your mind.',
  },
  {
    path: '/attendee/network',
    icon: 'users',
    title: 'Speed networking',
    body: 'Scan the QR on your table to sit down. Everyone at the table appears with their chapter and business, ready to save — and the clock shows how long is left in the round.',
  },
  {
    path: '/attendee',
    icon: 'award',
    title: 'That’s the whole app',
    body: 'Start this tour again any time from the button on Home. Anything that does not look right — a class, a stamp, your name — the committee desk can fix it on the spot.',
  },
]

export default function Tour() {
  const open = useTourStore((s) => s.open)
  const close = useTourStore((s) => s.close)
  const [step, setStep] = useState(0)
  const [muted, setMutedState] = useState(isMuted)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const current = STEPS[step]

  // Read the step aloud. A browser that will not speak yet — some wait for
  // the page to be touched — simply says nothing, and the next step tries
  // again.
  useEffect(() => {
    if (!open || !current) return
    speak(`${current.title}. ${current.body}`)
  }, [open, current])

  // Nothing should still be talking after the sheet is gone.
  useEffect(() => () => stop(), [])
  useEffect(() => {
    if (!open) stop()
  }, [open])

  // Walk the app as the tour talks about it.
  useEffect(() => {
    if (!open || !current) return
    if (pathname !== current.path) navigate(current.path)
  }, [open, current, pathname, navigate])

  if (!open || !current) return null

  const last = step === STEPS.length - 1
  const finish = () => {
    stop()
    close()
    setStep(0)
  }

  const toggleVoice = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
    if (!next) speak(`${current.title}. ${current.body}`)
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="How to use this app">
      <button className="tour-scrim" onClick={finish} aria-label="Close the tour" />
      <div className="tour-sheet">
        <div className="tour-head">
          <span className="tour-ic">
            <Icon name={current.icon} size={18} />
          </span>
          <span className="tour-count">
            Step {step + 1} of {STEPS.length}
          </span>
          {speechAvailable() && (
            <button
              className={`tour-voice${muted ? ' off' : ''}`}
              onClick={toggleVoice}
              aria-label={muted ? 'Read the tour out loud' : 'Stop reading out loud'}
              aria-pressed={!muted}
            >
              <Icon name={muted ? 'mute' : 'sound'} size={16} />
            </button>
          )}
          <button className="tour-skip" onClick={finish}>
            Skip
          </button>
        </div>

        <h3>{current.title}</h3>
        <p>{current.body}</p>

        <div className="tour-dots" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.title} className={i === step ? 'on' : ''} />
          ))}
        </div>

        <div className="tour-actions">
          {step > 0 && (
            <button className="btn ghost" onClick={() => setStep((n) => n - 1)}>
              Back
            </button>
          )}
          <button className="btn" onClick={() => (last ? finish() : setStep((n) => n + 1))}>
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
