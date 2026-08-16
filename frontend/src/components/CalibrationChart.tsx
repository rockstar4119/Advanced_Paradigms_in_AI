import { useState } from 'react'
import type { CalibrationBin } from '../types'

const W = 260
const H = 150
const PAD = { top: 8, right: 8, bottom: 20, left: 26 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const xOf = (v: number) => PAD.left + v * PLOT_W
const yOf = (v: number) => PAD.top + (1 - v) * PLOT_H

/**
 * Reliability diagram. Bars are observed accuracy per confidence bin; the
 * diagonal is what a perfectly calibrated model would produce. Bars under the
 * line mean the model is overconfident.
 */
export function CalibrationChart({ bins }: { bins: CalibrationBin[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const populated = bins.filter((bin) => bin.count > 0)
  if (populated.length === 0) return <p className="hint-text">No evaluated nodes.</p>

  const barWidth = PLOT_W / bins.length
  const active = hovered !== null ? bins[hovered] : null

  return (
    <div className="mini-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="mini-chart-svg" role="img" aria-label="Reliability diagram">
        {[0, 0.5, 1].map((v) => (
          <line key={v} x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)} className="trend-grid" />
        ))}
        {[0, 0.5, 1].map((v) => (
          <text key={v} x={PAD.left - 5} y={yOf(v) + 3} className="mini-axis-text" textAnchor="end">
            {v}
          </text>
        ))}

        {bins.map((bin, index) => {
          if (bin.count === 0) return null
          const height = bin.accuracy * PLOT_H
          const x = PAD.left + index * barWidth
          return (
            <g key={index} onPointerEnter={() => setHovered(index)} onPointerLeave={() => setHovered(null)}>
              <rect x={x} y={PAD.top} width={barWidth} height={PLOT_H} fill="transparent" />
              <rect
                x={x + 1}
                y={yOf(bin.accuracy)}
                width={barWidth - 2}
                height={Math.max(height, 1.5)}
                rx={2}
                className={hovered === index ? 'calib-bar active' : 'calib-bar'}
              />
            </g>
          )
        })}

        {/* perfect calibration */}
        <line x1={xOf(0)} y1={yOf(0)} x2={xOf(1)} y2={yOf(1)} className="calib-ideal" />

        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} className="m-axis" />
      </svg>

      <div className="mini-chart-foot">
        {active && active.count > 0 ? (
          <span>
            conf {active.lower.toFixed(1)}–{active.upper.toFixed(1)} · {active.count} nodes · acc{' '}
            <em>{active.accuracy.toFixed(2)}</em> vs conf <em>{active.mean_confidence.toFixed(2)}</em>
          </span>
        ) : (
          <span>bars = observed accuracy · dashed = perfect calibration</span>
        )}
      </div>
    </div>
  )
}
