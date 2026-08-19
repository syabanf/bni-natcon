import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from './api'

/*
 * Two draws, not one (MoM 19 Aug 2026): the Lucky Draw and the Doorprize,
 * each with its own winners and its own entry condition.
 *
 * The winner is chosen by the server and written down before it reaches this
 * screen. That matters on a stage: the list used to live in this component's
 * memory, so a reload — a dropped wifi, a closed lid — emptied it, and the
 * next spin could hand the same person a second prize in front of the room.
 */
const DRAWS = [
  { key: 'lucky', label: 'Lucky Draw' },
  { key: 'doorprize', label: 'Doorprize' },
]

function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}



const SHUFFLE_MS = 3600

export default function LuckyDraw({ onUnauthorized }) {
  const [drawKey, setDrawKey] = useState('lucky')
  const [draws, setDraws] = useState([])
  const [pool, setPool] = useState(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('idle') // idle | shuffling | winner
  const [current, setCurrent] = useState(null) // card face shown mid-shuffle
  const [winner, setWinner] = useState(null)
  const [winners, setWinners] = useState([])
  // Stage mode: the draw on the hall projector, nothing else on screen.
  const [stage, setStage] = useState(false)
  const timerRef = useRef(null)
  // Synchronous "a draw is running" latch. State cannot do this job: two key
  // presses in the same frame both read the pre-update phase.
  const drawingRef = useRef(false)

  // The tab labels carry each draw's winner count, so they have to be
  // refreshed alongside the pool — otherwise the tab says "0 drawn" above a
  // winner who is on screen.
  const loadDraws = useCallback(
    () => api.draws({ onUnauthorized }).then((d) => setDraws(d.draws || [])).catch(() => {}),
    [onUnauthorized],
  )

  const loadPool = useCallback(
    (key) =>
      api
        .drawPool(key, { onUnauthorized })
        .then((d) => {
          setPool(d.eligible || [])
          setWinners(d.winners || [])
          return loadDraws()
        })
        .catch((e) => {
          setPool([])
          setError(e.message)
        }),
    [onUnauthorized],
  )

  useEffect(() => {
    loadDraws()
  }, [loadDraws])

  useEffect(() => {
    setPhase('idle')
    setWinner(null)
    setPool(null)
    loadPool(drawKey)
    return () => clearTimeout(timerRef.current)
  }, [drawKey, loadPool])

  // The server decides who is eligible: enough booths visited, and not
  // already a winner of either draw.
  const deck = pool || []
  const draw = draws.find((d) => d.key === drawKey)

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
    if (deck.length === 0 || drawingRef.current) return
    drawingRef.current = true
    clearTimeout(timerRef.current)
    setPhase('shuffling')
    setWinner(null)
    setError('')
    // The server picks and records in one go; the shuffle is the ceremony
    // over the top of it. Asking first means a reload cannot lose the result
    // and two operators cannot pull the same name.
    const pending = api.drawPick(drawKey)
    const startedAt = Date.now()
    let i = 0

    const tick = () => {
      const elapsed = Date.now() - startedAt
      if (elapsed >= SHUFFLE_MS) {
        pending
          .then(({ winner: w }) => {
            setCurrent(null)
            setWinner(w)
            setWinners((prev) => [...prev, w])
            setPool((prev) => (prev || []).filter((e) => e.member_id !== w.member_id))
            setPhase('winner')
            loadDraws()
          })
          .catch((err) => {
            setError(err.message)
            setCurrent(null)
            setPhase('idle')
          })
          .finally(() => {
            drawingRef.current = false
          })
        return
      }
      // The faces flip through the whole room in order, wrapping around;
      // the flip slows down as the draw approaches its end.
      setCurrent(deck[i % deck.length])
      i += 1
      const progress = elapsed / SHUFFLE_MS
      const delay = 60 + progress * progress * 340
      timerRef.current = setTimeout(tick, delay)
    }
    tick()
  }

  // Nothing is behind the stage to scroll to, and Space — the draw key —
  // is also the browser's page-down. Without this the operator scrolls the
  // hidden page under the overlay and lands somewhere else on exit.
  useEffect(() => {
    if (!stage) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [stage])

  // No dependency array on purpose: the handler closes over `phase` and
  // `deck`, which change during a draw.
  useEffect(() => {
    if (!stage) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        exitStage()
        return
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (phase !== 'shuffling') start()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (pool === null) return <div className="empty">Loading the draw…</div>

  const stageContent = (
    <>
        {phase === 'idle' && (
          <div className="draw-idle">
            <div className="draw-deck">
              {deck.slice(0, 5).map((m, i) => (
                <div className="draw-card stacked" style={{ '--i': i }} key={m.member_id}>
                  <span className="dc-ini">{initials(m.name)}</span>
                </div>
              ))}
              {deck.length === 0 && (
                <div className="empty">
                  {draw?.min_booth_visits
                    ? `Nobody has visited ${draw.min_booth_visits} booths yet — lower the requirement or wait.`
                    : 'No attendees yet — import the list first.'}
                </div>
              )}
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
              <div className="draw-card face" key={current.member_id + Math.random()}>
                <span className="dc-ini">{initials(current.name)}</span>
                <b>{current.name}</b>
                <small>{current.chapter}</small>
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
                {winner.member_code}
              </span>
            </div>
            <button className="md-add draw-btn" onClick={start} disabled={deck.length === 0}>
              {deck.length === 0 ? 'Everyone eligible has won 🎉' : '✦ Draw the next winner'}
            </button>
          </div>
        )}
    </>
  )

  return (
    <>
      <div className="content-head">
        <div>
          <h1>{draw?.name || 'Draws'}</h1>
          <p className="micro">
            One ticket each. A winner of either draw is out of both — nobody takes two prizes home
          </p>
        </div>
        <div className="head-right">
          <span className="pill live">{deck.length} eligible</span>
          <button className="md-secondary" onClick={enterStage} disabled={deck.length === 0}>
            ⛶ Stage mode
          </button>
        </div>
      </div>

      {error && (
        <div className="error" onClick={() => setError('')}>
          {error}
        </div>
      )}

      <div className="panel report-panel">
        <div className="draw-tabs">
          {DRAWS.map((d) => {
            const info = draws.find((x) => x.key === d.key)
            return (
              <button
                key={d.key}
                className={`draw-tab${drawKey === d.key ? ' on' : ''}`}
                onClick={() => setDrawKey(d.key)}
              >
                <b>{d.label}</b>
                <small>{info ? `${info.winner_count} drawn` : ''}</small>
              </button>
            )
          })}
        </div>
        <div className="draw-rule">
          <label className="md-field">
            <span>
              Booths to visit before entering
              <em> — 0 lets everyone in; raise it to make the prize a reward for walking the floor</em>
            </span>
            <input
              type="number"
              min="0"
              value={draw?.min_booth_visits ?? 0}
              onChange={async (e) => {
                const min = Number(e.target.value)
                setDraws((prev) =>
                  prev.map((x) => (x.key === drawKey ? { ...x, min_booth_visits: min } : x)),
                )
                try {
                  await api.setDrawMinimum(drawKey, min)
                  await loadPool(drawKey)
                } catch (err) {
                  setError(err.message)
                }
              }}
            />
          </label>
          <button
            className="md-secondary"
            disabled={!winners.length}
            onClick={async () => {
              if (!confirm(`Clear all ${winners.length} winners of the ${draw?.name}?`)) return
              await api.resetDraw(drawKey)
              await loadPool(drawKey)
              setWinner(null)
              setPhase('idle')
            }}
          >
            Clear winners
          </button>
        </div>
      </div>

      <div className="panel report-panel draw-stage">{stageContent}</div>

      {stage &&
        createPortal(
          <div className="draw-fullscreen" role="dialog" aria-label="Lucky Draw — stage mode">
            <img className="dfs-brand" src="/brand/logo-horizontal-white.png" alt="BNI Natcon 2026" />
            <div className="dfs-body draw-stage">{stageContent}</div>
            <div className="dfs-foot">
              <span className="dfs-count">{deck.length} eligible</span>
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
              <div className="rank-row" key={w.member_id}>
                <span className="rank-no">#{i + 1}</span>
                <span className="rank-ini">{initials(w.name)}</span>
                <div className="rank-info">
                  <div className="rank-name">
                    {w.name} <small>· {w.chapter}</small>
                  </div>
                </div>
                <span className="rank-code">{w.member_code}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
