import { ClassMetricsTable } from './ClassMetricsTable'
import { StatTile } from './StatTile'
import { TrendChart } from './TrendChart'
import type { AugmentPathEvent, DoneEvent, IterationEvent, PropagationStreamEvent } from '../types'

interface MetricsPanelProps {
  doneEvent?: DoneEvent
  history: PropagationStreamEvent[]
  playheadIndex: number
}

function isIterationEvent(event: PropagationStreamEvent): event is IterationEvent {
  return event.type === 'iteration'
}

function isAugmentPathEvent(event: PropagationStreamEvent): event is AugmentPathEvent {
  return event.type === 'augment_path'
}

export function MetricsPanel({ doneEvent, history, playheadIndex }: MetricsPanelProps) {
  const visible = history.slice(0, playheadIndex + 1)
  const energyPoints = visible.filter(isIterationEvent).map((e) => e.energy)
  const flowPoints = visible.filter(isAugmentPathEvent).map((e) => e.total_flow)

  const matrix = doneEvent?.confusion_matrix ?? []
  const maxValue = matrix.length ? Math.max(...matrix.flat()) : 0

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Metrics</h2>
      </div>

      {energyPoints.length > 0 && <TrendChart points={energyPoints} title="Energy" valueFormat={(v) => v.toFixed(4)} />}
      {flowPoints.length > 0 && <TrendChart points={flowPoints} title="Max-flow" valueFormat={(v) => v.toFixed(2)} />}

      {!doneEvent && energyPoints.length === 0 && flowPoints.length === 0 && (
        <p className="hint-text">Run propagation to see live metrics.</p>
      )}

      {doneEvent && (
        <>
          <div className="stat-card">
            <span className="stat-value">{(doneEvent.accuracy * 100).toFixed(1)}%</span>
            <span className="stat-label">accuracy on held-out labels</span>
          </div>

          {doneEvent.mean_entropy !== undefined && (
            <div className="stat-grid stat-grid--single">
              <StatTile label="Mean uncertainty" value={`${doneEvent.mean_entropy.toFixed(2)} bits`} />
            </div>
          )}

          {doneEvent.per_class.length > 0 && <ClassMetricsTable perClass={doneEvent.per_class} />}

          <p className="matrix-caption matrix-caption--spaced">Confusion matrix</p>
          <div className="matrix-wrap">
            <table className="confusion-matrix">
              <tbody>
                {matrix.map((row, i) => (
                  <tr key={i}>
                    {row.map((value, j) => {
                      const intensity = maxValue ? value / maxValue : 0
                      return (
                        <td
                          key={j}
                          className={i === j ? 'diag' : undefined}
                          style={{ backgroundColor: `rgba(57, 135, 229, ${0.08 + intensity * 0.55})` }}
                        >
                          {value}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
