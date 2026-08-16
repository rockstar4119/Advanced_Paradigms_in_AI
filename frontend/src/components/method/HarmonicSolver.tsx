import { useEffect, useRef, useState } from 'react'
import { CLASS_COLORS, blendColor } from '../../lib/colors'
import { BRIDGE, TOY_EDGES, TOY_NODES, energyOf, harmonicInit, harmonicStep, toyAdjacency } from './toyGraph'

const W = 450
const H = 210
const N_CLASSES = 2

const isBridge = (i: number, j: number) =>
  (i === BRIDGE[0] && j === BRIDGE[1]) || (i === BRIDGE[1] && j === BRIDGE[0])

/**
 * The same sweep the backend runs, executed in the browser on eight nodes so
 * the reader can watch the fixed point arrive instead of taking it on faith.
 */
export function HarmonicSolver() {
  const adjacency = useRef(toyAdjacency()).current
  const [f, setF] = useState(() => harmonicInit(N_CLASSES))
  const [t, setT] = useState(0)
  const [trace, setTrace] = useState<number[]>(() => [energyOf(toyAdjacency(), harmonicInit(N_CLASSES))])
  const [playing, setPlaying] = useState(false)

  const step = () => {
    setF((prev) => {
      const next = harmonicStep(adjacency, prev, N_CLASSES)
      setTrace((old) => [...old, energyOf(adjacency, next)])
      return next
    })
    setT((prev) => prev + 1)
  }

  useEffect(() => {
    if (!playing) return
    if (t >= 40) {
      setPlaying(false)
      return
    }
    const timer = window.setTimeout(step, 260)
    return () => window.clearTimeout(timer)
  }, [playing, t])

  const reset = () => {
    setPlaying(false)
    setF(harmonicInit(N_CLASSES))
    setTrace([energyOf(adjacency, harmonicInit(N_CLASSES))])
    setT(0)
  }

  const energy = trace[trace.length - 1]
  const delta = trace.length > 1 ? Math.abs(trace[trace.length - 1] - trace[trace.length - 2]) : null
  const converged = delta !== null && delta < 1e-4

  const maxEnergy = Math.max(...trace, 1e-9)
  const tracePath = trace
    .map((value, index) => {
      const x = trace.length === 1 ? 0 : (index / (trace.length - 1)) * 150
      const y = 34 - (value / maxEnergy) * 30
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <figure className="m-figure">
      <figcaption className="m-figure-head">
        <span className="m-figure-title">The harmonic sweep, running</span>
        <span className="m-figure-sub">
          Two clamped labels, six unknowns, one weak bridge. Node fill is the class mixture f<sub>i</sub>.
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="m-figure-svg" role="img" aria-label="Harmonic propagation on an eight node graph">
        {TOY_EDGES.map(([i, j, w]) => (
          <line
            key={`${i}-${j}`}
            x1={TOY_NODES[i].x}
            y1={TOY_NODES[i].y}
            x2={TOY_NODES[j].x}
            y2={TOY_NODES[j].y}
            className={isBridge(i, j) ? 'm-toy-edge bridge' : 'm-toy-edge'}
            strokeWidth={0.8 + w * 2.4}
          />
        ))}

        <text x={(TOY_NODES[3].x + TOY_NODES[4].x) / 2} y={92} className="m-axis-text" textAnchor="middle">
          w = 0.15
        </text>

        {TOY_NODES.map((node) => {
          const mix = f[node.id]
          const clamped = node.observed !== null
          return (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={clamped ? 17 : 15}
                fill={blendColor(mix)}
                className={clamped ? 'm-toy-node clamped' : 'm-toy-node'}
              />
              <text x={node.x} y={node.y + 4} className="m-toy-node-text" textAnchor="middle">
                {mix[0].toFixed(2)}
              </text>
              {clamped && (
                <text x={node.x} y={node.y + 32} className="m-axis-text" textAnchor="middle">
                  clamped
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="m-solver-bar">
        <div className="m-solver-stats">
          <div>
            <span className="m-read-label">iteration t</span>
            <span className="m-read-value">{t}</span>
          </div>
          <div>
            <span className="m-read-label">energy E(f)</span>
            <span className="m-read-value accent">{energy.toFixed(5)}</span>
          </div>
          <div>
            <span className="m-read-label">|ΔE|</span>
            <span className={`m-read-value${converged ? ' converged' : ''}`}>
              {delta === null ? '—' : delta.toExponential(1)}
            </span>
          </div>
        </div>

        <svg viewBox="0 0 150 38" className="m-sparkline" role="img" aria-label="Energy per iteration, decreasing">
          <path d={tracePath} />
        </svg>
      </div>

      <div className="m-figure-controls m-solver-controls">
        <button type="button" onClick={step} disabled={playing || t >= 40}>
          Step
        </button>
        <button type="button" onClick={() => setPlaying((prev) => !prev)} disabled={t >= 40}>
          {playing ? 'Pause' : 'Run'}
        </button>
        <button type="button" className="ghost" onClick={reset}>
          Reset
        </button>
      </div>

      <div className="m-legend">
        {CLASS_COLORS.slice(0, 2).map((color, index) => (
          <span key={color} className="m-legend-item">
            <span className="swatch" style={{ background: color }} />
            class {index}
          </span>
        ))}
        <span className="m-legend-item">
          <span className="swatch" style={{ background: blendColor([0.5, 0.5]) }} />
          undecided
        </span>
      </div>

      <p className="m-figure-note">
        {converged
          ? `Converged at t = ${t}: every unlabeled node now holds the weighted average of its neighbours, and the energy has stopped moving. The two nodes flanking the bridge keep the least confident values on the graph — the model is telling you exactly where it would want its next label.`
          : 'Each press averages every unlabeled node over its neighbours, then snaps the two labeled nodes back to their observed values. Energy falls monotonically; the numbers stop moving once the harmonic condition holds everywhere.'}
      </p>
    </figure>
  )
}
