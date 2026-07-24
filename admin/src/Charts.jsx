import { useState } from 'react'

/*
 * Swiss-flavored flat charts (single red series on white, hairline grid,
 * tabular numerals). Every mark has a hover tooltip; identity comes from
 * axis labels, so no legend is needed for these single-series charts.
 */

function Tooltip({ tip }) {
  if (!tip) return null
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
      <b>{tip.title}</b>
      <span>{tip.value}</span>
    </div>
  )
}

// Vertical bars: data = [{ label, value, hint? }]
export function BarChart({ data, height = 180, valueLabel = '' }) {
  const [tip, setTip] = useState(null)
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <div className="chart-wrap" onMouseLeave={() => setTip(null)}>
      <div className="bar-chart" style={{ height }}>
        {data.map((d, i) => (
          <div
            className="bc-col"
            key={`${d.label}-${i}`}
            onMouseMove={(e) => {
              const rect = e.currentTarget.closest('.chart-wrap').getBoundingClientRect()
              setTip({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top - 14,
                title: d.hint || d.label,
                value: `${d.value}${valueLabel ? ` ${valueLabel}` : ''}`,
              })
            }}
          >
            <div className="bc-value">{d.value > 0 ? d.value : ''}</div>
            <div className="bc-track">
              <div className="bc-fill" style={{ height: `${(d.value / max) * 100}%` }} />
            </div>
            <div className="bc-label">{d.label}</div>
          </div>
        ))}
      </div>
      <Tooltip tip={tip} />
    </div>
  )
}

// Horizontal bars with an optional capacity context track:
// data = [{ label, sub?, value, total? }]
export function HBarChart({ data, valueLabel = '' }) {
  const [tip, setTip] = useState(null)
  const max = Math.max(1, ...data.map((d) => d.total ?? d.value))

  return (
    <div className="chart-wrap" onMouseLeave={() => setTip(null)}>
      <div className="hbar-chart">
        {data.map((d, i) => {
          const denom = d.total ?? max
          const pct = Math.min(100, (d.value / (d.total ? d.total : max)) * 100)
          return (
            <div
              className="hb-row"
              key={`${d.label}-${i}`}
              onMouseMove={(e) => {
                const rect = e.currentTarget.closest('.chart-wrap').getBoundingClientRect()
                setTip({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top - 14,
                  title: d.label,
                  value: d.total
                    ? `${d.value}/${d.total}${valueLabel ? ` ${valueLabel}` : ''} · ${Math.round((d.value / denom) * 100)}%`
                    : `${d.value}${valueLabel ? ` ${valueLabel}` : ''}`,
                })
              }}
            >
              <div className="hb-label">
                <b>{d.label}</b>
                {d.sub && <small>{d.sub}</small>}
              </div>
              <div className="hb-track">
                <div className="hb-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="hb-value">{d.total ? `${d.value}/${d.total}` : d.value}</div>
            </div>
          )
        })}
      </div>
      <Tooltip tip={tip} />
    </div>
  )
}
