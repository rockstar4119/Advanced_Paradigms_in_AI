import { useState } from 'react'
import { CLASS_COLORS, UNLABELED_COLOR } from '../../lib/colors'
import { BRIDGE, TOY_EDGES, TOY_NODES } from './toyGraph'

const W = 540
const H = 226
const SHIFT = 48
const SRC = { x: 24, y: 105 }
const SNK = { x: 516, y: 105 }

const px = (id: number) => TOY_NODES[id].x + SHIFT
const py = (id: number) => TOY_NODES[id].y

const isBridge = (i: number, j: number) =>
  (i === BRIDGE[0] && j === BRIDGE[1]) || (i === BRIDGE[1] && j === BRIDGE[0])

// The cut this network actually yields: the bridge is the cheapest edge set
// separating the clamped source node from the clamped sink node.
const S_SIDE = new Set([0, 1, 2, 3])

/**
 * The same eight nodes as the harmonic figure, rebuilt as an s–t flow network,
 * so the two methods can be compared on identical structure.
 */
export function MincutFigure() {
  const [showCut, setShowCut] = useState(false)

  return (
    <figure className="m-figure">
      <figcaption className="m-figure-head">
        <span className="m-figure-title">The same graph as a flow network</span>
        <span className="m-figure-sub">
          Labeled nodes are wired to s and t with infinite capacity; every original edge keeps its
          weight as capacity.
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="m-figure-svg" role="img" aria-label="Source sink network and its minimum cut">
        {showCut && (
          <>
            <rect x={6} y={8} width={266} height={190} rx={14} className="m-side-band s" />
            <rect x={280} y={8} width={254} height={190} rx={14} className="m-side-band t" />
          </>
        )}

        {/* terminal arcs */}
        <line x1={SRC.x} y1={SRC.y} x2={px(0)} y2={py(0)} className="m-terminal-edge s" />
        <line x1={px(7)} y1={py(7)} x2={SNK.x} y2={SNK.y} className="m-terminal-edge t" />
        <text x={(SRC.x + px(0)) / 2} y={96} className="m-axis-text" textAnchor="middle">
          ∞
        </text>
        <text x={(px(7) + SNK.x) / 2} y={96} className="m-axis-text" textAnchor="middle">
          ∞
        </text>

        {TOY_EDGES.map(([i, j, w]) => {
          const cutEdge = showCut && isBridge(i, j)
          return (
            <line
              key={`${i}-${j}`}
              x1={px(i)}
              y1={py(i)}
              x2={px(j)}
              y2={py(j)}
              className={`m-toy-edge${cutEdge ? ' cut' : ''}${isBridge(i, j) && !showCut ? ' bridge' : ''}`}
              strokeWidth={0.8 + w * 2.4}
            />
          )
        })}

        {showCut && (
          <g className="m-cut-line">
            <path d="M276 14 C 268 60, 284 150, 276 196" />
            <text x={276} y={212} className="m-cut-label" textAnchor="middle">
              cut cost = 0.15
            </text>
          </g>
        )}

        {[
          { pos: SRC, label: 's', cls: 0 },
          { pos: SNK, label: 't', cls: 1 },
        ].map((terminal) => (
          <g key={terminal.label}>
            <circle cx={terminal.pos.x} cy={terminal.pos.y} r={16} className="m-terminal" fill={CLASS_COLORS[terminal.cls]} />
            <text x={terminal.pos.x} y={terminal.pos.y + 5} className="m-toy-node-text" textAnchor="middle">
              {terminal.label}
            </text>
          </g>
        ))}

        {TOY_NODES.map((node) => {
          const fill = showCut
            ? CLASS_COLORS[S_SIDE.has(node.id) ? 0 : 1]
            : node.observed !== null
              ? CLASS_COLORS[node.observed]
              : UNLABELED_COLOR
          return (
            <g key={node.id}>
              <circle
                cx={px(node.id)}
                cy={py(node.id)}
                r={node.observed !== null ? 17 : 15}
                fill={fill}
                className={node.observed !== null ? 'm-toy-node clamped' : 'm-toy-node'}
              />
              <text x={px(node.id)} y={py(node.id) + 4} className="m-toy-node-text" textAnchor="middle">
                {node.id}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="m-figure-controls m-solver-controls">
        <button type="button" onClick={() => setShowCut((prev) => !prev)}>
          {showCut ? 'Show the network' : 'Find the minimum cut'}
        </button>
      </div>

      <div className="m-legend">
        <span className="m-legend-item">
          <span className="swatch" style={{ background: CLASS_COLORS[0] }} />
          source side (class 0)
        </span>
        <span className="m-legend-item">
          <span className="swatch" style={{ background: CLASS_COLORS[1] }} />
          sink side (class 1)
        </span>
      </div>

      <p className="m-figure-note">
        Every other candidate partition has to sever at least two intra-cluster edges of weight ≈ 0.9.
        Cutting the single bridge costs 0.15, so max-flow saturates there and stops. Note what the
        answer looks like: a hard partition, with node 3 and node 4 as confidently assigned as the
        clamped nodes themselves. That is the whole difference from the harmonic solution.
      </p>
    </figure>
  )
}
