import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from './api'

function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// Weighted pick: every pin is one ticket, so attendees with the most
// pins have the best odds.
function pickWeighted(pool) {
  const total = pool.reduce((sum, m) => sum + m.visits, 0)
  let roll = Math.random() * total
  for (const m of pool) {
    roll -= m.visits
    if (roll <= 0) return m
  }
  return pool[pool.length - 1]
}

const SHUFFLE_MS = 3600

export default function LuckyDraw({ onUnauthorized }) {
  const [members, setMembers] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | shuffling | winner
  const [current, setCurrent] = useState(null) // card face shown mid-shuffle
  const [winner, setWinner] = useState(null)
  const [winners, setWinners] = useState([])
  // Stage mode: the draw on the hall projector, nothing else on screen.
  const [stage, setStage] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    api
      .allMembers({ onUnauthorized })
      .then((all) => setMembers(all.filter((m) => m.visits > 0)))
      .catch(() => setMembers([]))
    return () => clearTimeout(timerRef.current)
  }, [onUnauthorized])

  const eligible = (members || []).filter((m) => !winners.some((w) => w.id === m.id))
  // Shuffle order: most pins first — they lead the deck and cycle through first.
  const deck = [...eligible].sort((a, b) => b.visits - a.visits)

  const enterStage = () => {
    setStage(true)
    // Real fullscreen is a bonus, not the mechanism — the overlay already
    // covers the screen, so a browser that refuses the request (or a policy
    // that blocks it) still gets the stage.
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const exitStage = useCallback(() => {
    setStage(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [])

  // Leaving fullscreen by any route — Esc, the browser chrome, the OS —
  // must drop the overlay too, or the operator is stuck on a stage screen.
  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement) setStage(false)
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const start = () => {
    if (deck.length === 0) return
    setPhase('shuffling')
    setWinner(null)
    const finalWinner = pickWeighted(deck)
    const startedAt = Date.now()
    let i = 0

    const tick = () => {
      const elapsed = Date.now() - startedAt
      if (elapsed >= SHUFFLE_MS) {
        setCurrent(null)
        setWinner(finalWinner)
        setWinners((w) => [...w, finalWinner])
        setPhase('winner')
        return
      }
      // Highest-pin members cycle first, then wrap; the flip slows down
      // as the draw approaches its end.
      setCurrent(deck[i % deck.length])
      i += 1
      const progress = elapsed / SHUFFLE_MS
      const delay = 60 + progress * progress * 340
      timerRef.current = setTimeout(tick, delay)
    }
    tick()
  }

  useEffect(() => {
    if (!stage) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        exitStage()
        return
      }
      if ((e.key === ' ' || e.key === 'Enter') && phase !== 'shuffling') {
        e.preventDefault()
        start()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (members === null) return <div className="empty">Loading attendees…</div>

  const draw = (
    <>
        {phase === 'idle' && (
          <div className="draw-idle">
            <div className="draw-deck">
              {deck.slice(0, 5).map((m, i) => (
                <div className="draw-card stacked" style={{ '--i': i }} key={m.id}>
                  <span className="dc-ini">{initials(m.name)}</span>
                </div>
              ))}
              {deck.length === 0 && <div className="empty">No attendees with pins yet — scans fill the deck.</div>}
            </div>
            {deck.length > 0 && (
              <button className="md-add draw-btn" onClick={start}>
                ✦ Shuffle &amp; draw a winner
              </button>
            )}
          </div>
        )}

        {phase === 'shuffling' && current && (
          <div className="draw-idle">
            <div className="draw-deck shuffling">
              <div className="draw-card face" key={current.id + Math.random()}>
                <span className="dc-ini">{initials(current.name)}</span>
                <b>{current.name}</b>
                <small>
                  {current.chapter} · {current.visits} pins
                </small>
              </div>
              <div className="draw-card stacked" style={{ '--i': 1 }} />
              <div className="draw-card stacked" style={{ '--i': 2 }} />
            </div>
            <div className="draw-note">Shuffling {deck.length} cards…</div>
          </div>
        )}

        {phase === 'winner' && winner && (
          <div className="draw-idle">
            <div className="draw-card winner">
              <span className="dc-crown">🏆</span>
              <span className="dc-ini big">{initials(winner.name)}</span>
              <b>{winner.name}</b>
              <small>
                {winner.chapter}
                {winner.company ? ` · ${winner.company}` : ''}
              </small>
              <span className="pill live" style={{ marginTop: 8 }}>
                {winner.visits} pins · {winner.member_code}
              </span>
            </div>
            <button className="md-add draw-btn" onClick={start} disabled={eligible.length === 0}>
              {eligible.length === 0 ? 'Everyone has won 🎉' : '✦ Draw the next winner'}
            </button>
          </div>
        )}
    </>
  )

  return (
    <>
      <div className="content-head">
        <div>
          <h1>Lucky Draw</h1>
          <p className="micro">
            Card shuffle across all attendees with pins — every pin is one ticket, top collectors
            lead the deck
          </p>
        </div>
        <div className="head-right">
          <span className="pill live">{eligible.length} eligible</span>
          <button className="md-secondary" onClick={enterStage} disabled={deck.length === 0}>
            ⛶ Stage mode
          </button>
        </div>
      </div>

      <div className="panel report-panel draw-stage">{draw}</div>

      {stage &&
        createPortal(
          <div className="draw-fullscreen" role="dialog" aria-label="Lucky Draw — stage mode">
            <img className="dfs-brand" src="/brand/logo-horizontal-white.png" alt="BNI Natcon 2026" />
            <div className="dfs-body draw-stage">{draw}</div>
            <div className="dfs-foot">
              <span className="dfs-count">{eligible.length} eligible</span>
              <span className="dfs-keys">
                <b>Space</b> draw · <b>Esc</b> exit
              </span>
              {winners.length > 0 && (
                <span className="dfs-won">
                  {winners.length} drawn: {winners.map((w) => w.name.split(' ')[0]).join(' · ')}
                </span>
              )}
            </div>
            <button className="dfs-exit" onClick={exitStage} aria-label="Leave stage mode">
              ✕
            </button>
          </div>,
          document.body,
        )}

      {winners.length > 0 && (
        <div className="panel report-panel">
          <h2>
            <span className="sec-no">{winners.length}</span>Winners so far
          </h2>
          <p className="panel-sub">In draw order — announce on stage as you go</p>
          <div className="rank-list">
            {winners.map((w, i) => (
              <div className="rank-row" key={w.id}>
                <span className="rank-no">#{i + 1}</span>
                <span className="rank-ini">{initials(w.name)}</span>
                <div className="rank-info">
                  <div className="rank-name">
                    {w.name} <small>· {w.chapter}</small>
                  </div>
                </div>
                <span className="rank-count">{w.visits}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
