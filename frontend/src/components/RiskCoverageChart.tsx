import { useState } from 'react'
import type { RiskCoveragePoint } from '../types'

const W = 260
const H = 130
const PAD = { top: 8, right: 8, bottom: 20, left: 30 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

/**
 * Risk–coverage: how accuracy improves as you decline to predict on the least
 * confident nodes. A curve that climbs steeply means confidence is a usable
 * abstention signal; a flat one means it is not.
 */
export function RiskCoverageChart({
  points,
  baseline,
}: {
  points: RiskCoveragePoint[]
  baseline: number
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  if (points.length < 2) return <p className="hint-text">Not enough evaluated nodes.</p>

  const accuracies = points.map((p) => p.accuracy)
  const lo = Math.min(...accuracies, baseline) - 0.02
  const hi = Math.max(...accuracies, baseline) + 0.02
  const span = Math.max(hi - lo, 1e-6)

  const xOf = (coverage: number) => PAD.left + (1 - coverage) * PLOT_W
  const yOf = (accuracy: number) => PAD.top + (1 - (accuracy - lo) / span) * PLOT_H

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.coverage).toFixed(2)},${yOf(p.accuracy).toFixed(2)}`)
    .join(' ')

  const active = hovered !== null ? points[hovered] : null

  return (
    <div className="mini-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mini-chart-svg"
        role="img"
        aria-label="Risk coverage curve"
        onPointerLeave={() => setHovered(null)}
      >
        <line x1={PAD.left} y1={yOf(baseline)} x2={W - PAD.right} y2={yOf(baseline)} className="rc-baseline" />
        <text x={W - PAD.right} y={yOf(baseline) - 4} className="mini-axis-text" textAnchor="end">
          all nodes {baseline.toFixed(2)}
        </text>

        <path d={path} className="rc-curve" />

        {points.map((p, index) => (
          <g key={index} onPointerEnter={() => setHovered(index)}>
            <rect
              x={xOf(p.coverage) - 5}
              y={PAD.top}
              width={10}
              height={PLOT_H}
              fill="transparent"
            />
            {hovered === index && <circle cx={xOf(p.coverage)} cy={yOf(p.accuracy)} r={4} className="rc-dot" />}
          </g>
        ))}

        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} className="m-axis" />
      </svg>

      <div className="mini-chart-foot">
        {active ? (
          <span>
            keep top <em>{(active.coverage * 100).toFixed(0)}%</em> ({active.n_kept} nodes) → accuracy{' '}
            <em>{active.accuracy.toFixed(3)}</em>
          </span>
        ) : (
          <span>← coverage falls · accuracy on what you keep</span>
        )}
      </div>
    </div>
  )
}
