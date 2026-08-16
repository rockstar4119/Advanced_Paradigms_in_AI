import { useState } from 'react'
import type { RoundPoint } from '../../types'

const W = 560
const H = 240
const PAD = { top: 18, right: 74, bottom: 34, left: 44 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

// Two series, identity-coded: fixed categorical slots, never reassigned.
const GUIDED = '#3987e5'
const RANDOM = '#d95926'

interface RaceChartProps {
  guided: RoundPoint[]
  random: RoundPoint[]
}

/**
 * The headline: accuracy per label spent, guided against random, on the same
 * held-out set. One y-axis, two series, direct-labelled at their end points.
 */
export function RaceChart({ guided, random }: RaceChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const all = [...guided, ...random]
  if (all.length === 0) return null

  const maxLabels = Math.max(...all.map((p) => p.n_labels), 1)
  const minLabels = Math.min(...all.map((p) => p.n_labels), 0)
  const labelSpan = Math.max(maxLabels - minLabels, 1)

  const accuracies = all.map((p) => p.accuracy)
  const lo = Math.max(0, Math.min(...accuracies) - 0.06)
  const hi = Math.min(1, Math.max(...accuracies) + 0.06)
  const span = Math.max(hi - lo, 1e-6)

  const xOf = (labels: number) => PAD.left + ((labels - minLabels) / labelSpan) * PLOT_W
  const yOf = (accuracy: number) => PAD.top + (1 - (accuracy - lo) / span) * PLOT_H

  const pathOf = (points: RoundPoint[]) =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.n_labels).toFixed(2)},${yOf(p.accuracy).toFixed(2)}`)
      .join(' ')

  const lastGuided = guided[guided.length - 1]
  const lastRandom = random[random.length - 1]
  const gap = lastGuided && lastRandom ? lastGuided.accuracy - lastRandom.accuracy : 0

  const rounds = Math.max(guided.length, random.length)
  const activeGuided = hovered !== null ? guided[hovered] : null
  const activeRandom = hovered !== null ? random[hovered] : null

  return (
    <div className="race-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="race-svg"
        role="img"
        aria-label="Accuracy per label spent, guided versus random"
        onPointerLeave={() => setHovered(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const value = lo + t * span
          return (
            <g key={t}>
              <line x1={PAD.left} y1={yOf(value)} x2={W - PAD.right} y2={yOf(value)} className="trend-grid" />
              <text x={PAD.left - 8} y={yOf(value) + 3.5} className="mini-axis-text" textAnchor="end">
                {value.toFixed(2)}
              </text>
            </g>
          )
        })}

        {/* the gap is the whole point — shade it */}
        {lastGuided && lastRandom && gap > 0 && (
          <path
            d={`${pathOf(guided)} L${xOf(lastRandom.n_labels)},${yOf(lastRandom.accuracy)} ${pathOf(random)
              .replace('M', 'L')
              .split(' ')
              .reverse()
              .join(' ')} Z`}
            className="race-gap"
          />
        )}

        <path d={pathOf(random)} className="race-line" stroke={RANDOM} />
        <path d={pathOf(guided)} className="race-line" stroke={GUIDED} />

        {guided.map((p, index) => (
          <circle key={`g${index}`} cx={xOf(p.n_labels)} cy={yOf(p.accuracy)} r={3.5} fill={GUIDED} className="race-dot" />
        ))}
        {random.map((p, index) => (
          <circle key={`r${index}`} cx={xOf(p.n_labels)} cy={yOf(p.accuracy)} r={3.5} fill={RANDOM} className="race-dot" />
        ))}

        {/* direct labels beat a legend lookup */}
        {lastGuided && (
          <text x={xOf(lastGuided.n_labels) + 9} y={yOf(lastGuided.accuracy) + 4} className="race-label" fill={GUIDED}>
            guided {lastGuided.accuracy.toFixed(2)}
          </text>
        )}
        {lastRandom && (
          <text x={xOf(lastRandom.n_labels) + 9} y={yOf(lastRandom.accuracy) + 4} className="race-label" fill={RANDOM}>
            random {lastRandom.accuracy.toFixed(2)}
          </text>
        )}

        {Array.from({ length: rounds }, (_, index) => {
          const point = guided[index] ?? random[index]
          if (!point) return null
          return (
            <g key={`hit${index}`} onPointerEnter={() => setHovered(index)}>
              <rect x={xOf(point.n_labels) - 10} y={PAD.top} width={20} height={PLOT_H} fill="transparent" />
              {hovered === index && (
                <line x1={xOf(point.n_labels)} y1={PAD.top} x2={xOf(point.n_labels)} y2={H - PAD.bottom} className="race-crosshair" />
              )}
            </g>
          )
        })}

        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} className="m-axis" />
        <text x={PAD.left} y={H - 8} className="mini-axis-text">
          {minLabels} labels
        </text>
        <text x={W - PAD.right} y={H - 8} className="mini-axis-text" textAnchor="end">
          {maxLabels} labels
        </text>
      </svg>

      <div className="race-foot">
        {activeGuided || activeRandom ? (
          <span>
            {(activeGuided ?? activeRandom)?.n_labels} labels spent · guided{' '}
            <em style={{ color: GUIDED }}>{activeGuided?.accuracy.toFixed(3) ?? '—'}</em> · random{' '}
            <em style={{ color: RANDOM }}>{activeRandom?.accuracy.toFixed(3) ?? '—'}</em>
          </span>
        ) : (
          <span>
            both tracks scored on the same held-out nodes, which neither is ever allowed to label
          </span>
        )}
      </div>
    </div>
  )
}
