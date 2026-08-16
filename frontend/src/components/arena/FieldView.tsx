import { useMemo, useState } from 'react'
import { classColor } from '../../lib/colors'
import type { ArenaTrack, NodeOut } from '../../types'

export type FieldMode = 'prediction' | 'uncertainty' | 'error'

const W = 460
const H = 300
const PAD = 18

// Sequential ramp for uncertainty: one hue, light -> dark, never a rainbow.
const UNCERTAINTY_RAMP = ['#1c2333', '#2f3d63', '#4a5aa0', '#6b74cf', '#9085e9']

function uncertaintyColor(entropy: number, maxEntropy: number): string {
  if (maxEntropy <= 0) return UNCERTAINTY_RAMP[0]
  const t = Math.min(Math.max(entropy / maxEntropy, 0), 1)
  return UNCERTAINTY_RAMP[Math.min(UNCERTAINTY_RAMP.length - 1, Math.floor(t * UNCERTAINTY_RAMP.length))]
}

interface FieldViewProps {
  nodes: NodeOut[]
  track: ArenaTrack
  holdout: number[]
  suggestions: number[]
  mode: FieldMode
  nClasses: number
}

/**
 * The whole dataset at a glance. Same projection the studio canvas uses, but
 * painted by whichever interpretability signal you want to read — and with the
 * oracle's next picks ringed, so you can watch them land on the boundary.
 */
export function FieldView({ nodes, track, holdout, suggestions, mode, nClasses }: FieldViewProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const project = useMemo(() => {
    const xs = nodes.map((n) => n.x)
    const ys = nodes.map((n) => n.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const spanX = maxX - minX || 1
    const spanY = maxY - minY || 1
    return (node: NodeOut) => ({
      cx: PAD + ((node.x - minX) / spanX) * (W - PAD * 2),
      cy: PAD + ((node.y - minY) / spanY) * (H - PAD * 2),
    })
  }, [nodes])

  const maxEntropy = Math.log2(Math.max(nClasses, 2))
  const holdoutSet = useMemo(() => new Set(holdout), [holdout])
  const suggestionSet = useMemo(() => new Set(suggestions), [suggestions])
  const newlySet = useMemo(() => new Set(track.newly_labeled), [track.newly_labeled])

  const fillFor = (node: NodeOut) => {
    if (mode === 'uncertainty') return uncertaintyColor(track.entropy[node.id] ?? 0, maxEntropy)
    if (mode === 'error') {
      const correct = track.predictions[node.id] === node.true_label
      return correct ? '#199e70' : '#e66767'
    }
    return classColor(track.predictions[node.id] ?? 0)
  }

  const hoveredNode = hovered !== null ? nodes.find((n) => n.id === hovered) : undefined

  return (
    <div className="field-view">
      <svg viewBox={`0 0 ${W} ${H}`} className="field-svg" role="img" aria-label="Dataset field view">
        {nodes.map((node) => {
          const { cx, cy } = project(node)
          const isLabeled = track.observed[node.id] >= 0
          const isHoldout = holdoutSet.has(node.id)
          const isSuggested = suggestionSet.has(node.id)
          const isNew = newlySet.has(node.id)

          return (
            <g
              key={node.id}
              onPointerEnter={() => setHovered(node.id)}
              onPointerLeave={() => setHovered(null)}
            >
              {isSuggested && <circle cx={cx} cy={cy} r={9} className="field-suggested" />}
              {isNew && <circle cx={cx} cy={cy} r={8} className="field-new" />}
              <circle
                cx={cx}
                cy={cy}
                r={isLabeled ? 5 : 3.4}
                fill={fillFor(node)}
                className={`field-node${isLabeled ? ' labeled' : ''}${isHoldout ? ' holdout' : ''}`}
              />
            </g>
          )
        })}
      </svg>

      <div className="field-foot">
        {hoveredNode ? (
          <span>
            node <em>{hoveredNode.id}</em> · pred{' '}
            <em>{track.predictions[hoveredNode.id]}</em> / true <em>{hoveredNode.true_label}</em> ·
            conf <em>{(track.confidence[hoveredNode.id] ?? 0).toFixed(2)}</em> · H{' '}
            <em>{(track.entropy[hoveredNode.id] ?? 0).toFixed(2)}</em>
            {holdoutSet.has(hoveredNode.id) && ' · held out'}
          </span>
        ) : (
          <span>
            big dots are labeled · dashed rings are held out · violet rings are the oracle's next picks
          </span>
        )}
      </div>
    </div>
  )
}

export function FieldLegend({ mode, nClasses }: { mode: FieldMode; nClasses: number }) {
  if (mode === 'error') {
    return (
      <div className="m-legend">
        <span className="m-legend-item">
          <span className="swatch" style={{ background: '#199e70' }} />
          correct
        </span>
        <span className="m-legend-item">
          <span className="swatch" style={{ background: '#e66767' }} />
          wrong
        </span>
      </div>
    )
  }

  if (mode === 'uncertainty') {
    return (
      <div className="m-legend">
        <span className="m-legend-item">
          <span className="ramp-strip">
            {UNCERTAINTY_RAMP.map((color) => (
              <span key={color} style={{ background: color }} />
            ))}
          </span>
          certain → uncertain
        </span>
      </div>
    )
  }

  return (
    <div className="m-legend">
      {Array.from({ length: nClasses }, (_, index) => (
        <span key={index} className="m-legend-item">
          <span className="swatch" style={{ background: classColor(index) }} />
          class {index}
        </span>
      ))}
    </div>
  )
}
