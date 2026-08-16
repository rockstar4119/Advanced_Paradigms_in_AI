import { useState } from 'react'
import type { Histogram as HistogramData } from '../types'

const W = 260
const H = 54
const GAP = 2

/** Compact distribution bar chart with per-bin hover — one series, so no legend. */
export function Histogram({
  histogram,
  format,
}: {
  histogram: HistogramData
  format: (value: number) => string
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const { counts, bin_edges: edges } = histogram
  const peak = Math.max(...counts, 1)
  const barWidth = counts.length > 0 ? (W - GAP * (counts.length - 1)) / counts.length : W

  const active = hovered !== null ? hovered : null

  return (
    <div className="histogram">
      <svg viewBox={`0 0 ${W} ${H}`} className="histogram-svg" role="img" aria-label="Distribution">
        {counts.map((count, index) => {
          const height = peak > 0 ? (count / peak) * (H - 6) : 0
          const x = index * (barWidth + GAP)
          return (
            <g key={index} onPointerEnter={() => setHovered(index)} onPointerLeave={() => setHovered(null)}>
              {/* full-height hit target so thin bars stay easy to hover */}
              <rect x={x} y={0} width={barWidth} height={H} fill="transparent" />
              <rect
                x={x}
                y={H - height}
                width={barWidth}
                height={Math.max(height, count > 0 ? 1.5 : 0)}
                rx={Math.min(2, barWidth / 2)}
                className={active === index ? 'histogram-bar active' : 'histogram-bar'}
              />
            </g>
          )
        })}
      </svg>

      <div className="histogram-axis">
        {active === null ? (
          <>
            <span>{format(edges[0])}</span>
            <span>{format(edges[edges.length - 1])}</span>
          </>
        ) : (
          <span className="histogram-readout">
            {format(edges[active])} – {format(edges[active + 1])}
            <em>{counts[active]} node{counts[active] === 1 ? '' : 's'}</em>
          </span>
        )}
      </div>
    </div>
  )
}
