import { useMemo, useRef, useState } from 'react'
import { rangeProgress } from '../../lib/ui'

const W = 520
const H = 210
const PAD = { top: 14, right: 16, bottom: 30, left: 44 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom
const D_MAX = 3

const xOf = (d: number) => PAD.left + (d / D_MAX) * PLOT_W
const yOf = (w: number) => PAD.top + (1 - w) * PLOT_H
const weightAt = (d: number, sigma: number) => Math.exp(-(d * d) / (2 * sigma * sigma))

/**
 * The kernel is the one place where a modelling choice becomes a number on
 * every edge, so it gets a live figure rather than a static curve.
 */
export function KernelExplorer() {
  const [sigma, setSigma] = useState(0.6)
  const [tau, setTau] = useState(0.2)
  const [hoverD, setHoverD] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const path = useMemo(() => {
    const points: string[] = []
    for (let i = 0; i <= 120; i += 1) {
      const d = (i / 120) * D_MAX
      points.push(`${i === 0 ? 'M' : 'L'}${xOf(d).toFixed(2)},${yOf(weightAt(d, sigma)).toFixed(2)}`)
    }
    return points.join(' ')
  }, [sigma])

  // Distance at which the kernel drops through τ — the effective edge radius.
  const cutoff = tau > 0 && tau < 1 ? sigma * Math.sqrt(-2 * Math.log(tau)) : null

  const handleMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * W
    const d = ((px - PAD.left) / PLOT_W) * D_MAX
    setHoverD(d >= 0 && d <= D_MAX ? d : null)
  }

  const readD = hoverD ?? sigma
  const readW = weightAt(readD, sigma)

  return (
    <figure className="m-figure">
      <figcaption className="m-figure-head">
        <span className="m-figure-title">Edge weight against distance</span>
        <span className="m-figure-sub">
          One curve, w(δ) = exp(−δ² ⁄ 2σ²). σ is the only thing setting what “close” means.
        </span>
      </figcaption>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="m-figure-svg"
        role="img"
        aria-label={`Gaussian kernel decay at sigma ${sigma.toFixed(2)}`}
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverD(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((w) => (
          <g key={w}>
            <line x1={PAD.left} y1={yOf(w)} x2={W - PAD.right} y2={yOf(w)} className="m-grid" />
            <text x={PAD.left - 8} y={yOf(w) + 3.5} className="m-axis-text" textAnchor="end">
              {w.toFixed(2)}
            </text>
          </g>
        ))}

        {/* kept region: pairs whose weight clears the sparsify threshold */}
        {cutoff !== null && cutoff <= D_MAX && (
          <rect
            x={PAD.left}
            y={PAD.top}
            width={xOf(cutoff) - PAD.left}
            height={PLOT_H}
            className="m-kept-band"
          />
        )}

        <line x1={PAD.left} y1={yOf(tau)} x2={W - PAD.right} y2={yOf(tau)} className="m-threshold" />
        <text x={W - PAD.right} y={yOf(tau) - 6} className="m-axis-text m-threshold-text" textAnchor="end">
          τ = {tau.toFixed(2)}
        </text>

        <path d={path} className="m-curve" />

        {/* σ, 2σ landmarks: the 61% / 14% rule of thumb */}
        {[1, 2].map((mult) => {
          const d = sigma * mult
          if (d > D_MAX) return null
          return (
            <g key={mult}>
              <line x1={xOf(d)} y1={yOf(weightAt(d, sigma))} x2={xOf(d)} y2={H - PAD.bottom} className="m-landmark" />
              <circle cx={xOf(d)} cy={yOf(weightAt(d, sigma))} r={4} className="m-landmark-dot" />
              <text x={xOf(d)} y={H - PAD.bottom + 15} className="m-axis-text" textAnchor="middle">
                {mult === 1 ? 'σ' : '2σ'}
              </text>
            </g>
          )
        })}

        {hoverD !== null && (
          <g className="m-crosshair">
            <line x1={xOf(hoverD)} y1={PAD.top} x2={xOf(hoverD)} y2={H - PAD.bottom} />
            <circle cx={xOf(hoverD)} cy={yOf(weightAt(hoverD, sigma))} r={5} />
          </g>
        )}

        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} className="m-axis" />
        <text x={W - PAD.right} y={H - 6} className="m-axis-text" textAnchor="end">
          distance δ →
        </text>
      </svg>

      <div className="m-figure-readout">
        <div>
          <span className="m-read-label">δ</span>
          <span className="m-read-value">{readD.toFixed(2)}</span>
        </div>
        <div>
          <span className="m-read-label">weight</span>
          <span className="m-read-value accent">{readW.toFixed(3)}</span>
        </div>
        <div>
          <span className="m-read-label">edge radius at τ</span>
          <span className="m-read-value">{cutoff === null ? '∞' : `${cutoff.toFixed(2)}`}</span>
        </div>
      </div>

      <div className="m-figure-controls">
        <label>
          <span className="m-ctrl-label">
            Bandwidth σ <em>{sigma.toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0.15}
            max={1.5}
            step={0.05}
            value={sigma}
            style={rangeProgress(sigma, 0.15, 1.5)}
            onChange={(event) => setSigma(Number(event.target.value))}
          />
        </label>
        <label>
          <span className="m-ctrl-label">
            Sparsify τ <em>{tau.toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.05}
            value={tau}
            style={rangeProgress(tau, 0, 0.9)}
            onChange={(event) => setTau(Number(event.target.value))}
          />
        </label>
      </div>

      <p className="m-figure-note">
        Drop σ and the curve collapses onto the origin — every pair looks equally far away, the graph
        shatters, and labels have nothing to travel along. Raise it and the kernel flattens toward 1,
        wiring the two classes together into one blob. The useful setting is the one where σ sits at
        roughly the typical nearest-neighbour distance of your data.
      </p>
    </figure>
  )
}
