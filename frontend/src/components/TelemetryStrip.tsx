import type { PropagationStreamEvent } from '../types'

interface TelemetryStripProps {
  history: PropagationStreamEvent[]
  playheadIndex: number
  isRunning: boolean
}

function describe(event: PropagationStreamEvent): string | null {
  switch (event.type) {
    case 'iteration':
      return `ITERATION ${event.t} · ENERGY ${event.energy.toFixed(4)}`
    case 'augment_path':
      return `AUGMENTING PATH FOUND · FLOW ${event.total_flow.toFixed(2)} (+${event.flow_added.toFixed(2)})`
    case 'mincut_found':
      return `MIN-CUT LOCATED · ${event.cut_edges.length} EDGE${event.cut_edges.length === 1 ? '' : 'S'} SEVERED`
    case 'done':
      return `CONVERGED · ${(event.accuracy * 100).toFixed(1)}% ACCURACY`
    default:
      return null
  }
}

export function TelemetryStrip({ history, playheadIndex, isRunning }: TelemetryStripProps) {
  const event = history[playheadIndex]
  if (!event) return null

  const text = describe(event)
  if (!text) return null

  return (
    <div className={`telemetry-strip${isRunning ? ' live' : ''}`}>
      <span className="telemetry-dot" />
      {text}
    </div>
  )
}
