import type { EfficiencyPoint } from '../types'

const WIDTH = 260
const HEIGHT = 108
const PAD_X = 10
const PAD_Y = 14
const COLOR = 'var(--accent)'

export function EfficiencyChart({ points }: { points: EfficiencyPoint[] }) {
  if (points.length === 0) return null

  const sorted = [...points].sort((a, b) => a.label_fraction - b.label_fraction)
  const maxFraction = Math.max(...sorted.map((p) => p.label_fraction))

  const toX = (fraction: number) => PAD_X + (fraction / maxFraction) * (WIDTH - PAD_X * 2)
  const toY = (accuracy: number) => HEIGHT - PAD_Y - accuracy * (HEIGHT - PAD_Y * 2)

  const linePath = sorted
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.label_fraction).toFixed(1)} ${toY(p.accuracy).toFixed(1)}`)
    .join(' ')
  const areaPath = `${linePath} L ${toX(sorted[sorted.length - 1].label_fraction).toFixed(1)} ${HEIGHT - PAD_Y} L ${toX(
    sorted[0].label_fraction,
  ).toFixed(1)} ${HEIGHT - PAD_Y} Z`

  const last = sorted[sorted.length - 1]

  return (
    <div className="trend-chart">
      <div className="trend-head">
        <span className="trend-title">Accuracy vs. label budget</span>
        <span className="trend-value" style={{ color: COLOR }}>
          {(last.accuracy * 100).toFixed(0)}% @ {(last.label_fraction * 100).toFixed(0)}%
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="trend-svg"
        role="img"
        aria-label={`Accuracy climbs to ${(last.accuracy * 100).toFixed(0)} percent by ${(last.label_fraction * 100).toFixed(0)} percent labeled`}
      >
        <line x1={PAD_X} y1={toY(0.5)} x2={WIDTH - PAD_X} y2={toY(0.5)} className="trend-grid" />
        <path d={areaPath} fill={COLOR} opacity={0.14} stroke="none" />
        <path d={linePath} fill="none" stroke={COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {sorted.map((p) => (
          <circle
            key={p.label_fraction}
            cx={toX(p.label_fraction)}
            cy={toY(p.accuracy)}
            r={3.2}
            fill={COLOR}
            stroke="var(--surface-2)"
            strokeWidth={2}
          />
        ))}
      </svg>
      <div className="trend-axis">
        <span>{(sorted[0].label_fraction * 100).toFixed(0)}% labeled</span>
        <span>{(maxFraction * 100).toFixed(0)}% labeled</span>
      </div>
    </div>
  )
}
