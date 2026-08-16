const WIDTH = 260
const HEIGHT = 92
const PAD_X = 4
const PAD_Y = 12

interface TrendChartProps {
  points: number[]
  title: string
  valueFormat?: (value: number) => string
  color?: string
}

export function TrendChart({ points, title, valueFormat = (v) => v.toFixed(3), color = 'var(--accent)' }: TrendChartProps) {
  if (points.length === 0) return null

  const minValue = Math.min(...points)
  const maxValue = Math.max(...points)
  const span = maxValue - minValue || 1

  const toX = (i: number) => PAD_X + (i / Math.max(1, points.length - 1)) * (WIDTH - PAD_X * 2)
  const toY = (v: number) => HEIGHT - PAD_Y - ((v - minValue) / span) * (HEIGHT - PAD_Y * 2)

  const linePath = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${toX(points.length - 1).toFixed(1)} ${HEIGHT - PAD_Y} L ${toX(0).toFixed(1)} ${HEIGHT - PAD_Y} Z`

  const lastValue = points[points.length - 1]
  const lastX = toX(points.length - 1)
  const lastY = toY(lastValue)
  const midY = toY(minValue + span / 2)

  return (
    <div className="trend-chart">
      <div className="trend-head">
        <span className="trend-title">{title}</span>
        <span className="trend-value" style={{ color }}>
          {valueFormat(lastValue)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="trend-svg"
        role="img"
        aria-label={`${title}: ${valueFormat(lastValue)}, ${points.length} points`}
      >
        <line x1={PAD_X} y1={midY} x2={WIDTH - PAD_X} y2={midY} className="trend-grid" />
        <path d={areaPath} fill={color} opacity={0.14} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastY} r={5} fill="var(--surface-2)" />
        <circle cx={lastX} cy={lastY} r={3.2} fill={color} />
      </svg>
    </div>
  )
}
