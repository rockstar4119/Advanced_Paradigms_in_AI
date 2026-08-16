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

const percent = (value: number) => `${(value * 100).toFixed(1)}%`
const decimal = (value: number) => value.toFixed(3)

/**
 * Chance-corrected agreement is the honest read on an imbalanced graph: at 90%
 * infected, a model that predicts "infected" for everyone scores 0.90 accuracy
 * and 0.00 kappa. Colour the two agreement scores so that gap is unmissable.
 */
function agreementAccent(value: number): string | undefined {
  if (value >= 0.8) return SUCCESS_COLOR
  if (value >= 0.5) return undefined
  return WARN_COLOR
}

/** Confidence minus accuracy: positive means the posterior is overselling. */
function calibrationAccent(gap: number): string | undefined {
  return Math.abs(gap) >= 0.1 ? WARN_COLOR : undefined
}

const SUCCESS_COLOR = '#199e70'
const WARN_COLOR = '#e66767'

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
            <span className="stat-value">{percent(doneEvent.accuracy)}</span>
            <span className="stat-label">
              accuracy on {doneEvent.n_evaluated ?? 0} held-out nodes
            </span>
          </div>

          <p className="matrix-caption">Agreement &amp; balance</p>
          <div className="stat-grid">
            {doneEvent.balanced_accuracy !== undefined && (
              <StatTile label="Balanced accuracy" value={percent(doneEvent.balanced_accuracy)} />
            )}
            {doneEvent.macro_f1 !== undefined && (
              <StatTile label="Macro F1" value={percent(doneEvent.macro_f1)} />
            )}
            {doneEvent.weighted_f1 !== undefined && (
              <StatTile label="Weighted F1" value={percent(doneEvent.weighted_f1)} />
            )}
            {doneEvent.macro_precision !== undefined && doneEvent.macro_recall !== undefined && (
              <StatTile
                label="Macro P / R"
                value={`${percent(doneEvent.macro_precision)} / ${percent(doneEvent.macro_recall)}`}
              />
            )}
            {doneEvent.cohen_kappa !== undefined && (
              <StatTile
                label="Cohen's kappa"
                value={decimal(doneEvent.cohen_kappa)}
                accent={agreementAccent(doneEvent.cohen_kappa)}
              />
            )}
            {doneEvent.matthews_corrcoef !== undefined && (
              <StatTile
                label="Matthews corr."
                value={decimal(doneEvent.matthews_corrcoef)}
                accent={agreementAccent(doneEvent.matthews_corrcoef)}
              />
            )}
          </div>

          {doneEvent.mean_entropy !== undefined ? (
            <>
              <p className="matrix-caption matrix-caption--spaced">Posterior quality</p>
              <div className="stat-grid">
                <StatTile label="Mean uncertainty" value={`${doneEvent.mean_entropy.toFixed(2)} bits`} />
                {doneEvent.auroc_macro !== undefined && (
                  <StatTile label="AUROC (macro OvR)" value={decimal(doneEvent.auroc_macro)} />
                )}
                {doneEvent.brier_score !== undefined && (
                  <StatTile label="Brier score" value={decimal(doneEvent.brier_score)} />
                )}
                {doneEvent.log_loss !== undefined && (
                  <StatTile label="Log loss" value={decimal(doneEvent.log_loss)} />
                )}
                {doneEvent.mean_margin !== undefined && (
                  <StatTile label="Mean margin" value={decimal(doneEvent.mean_margin)} />
                )}
                {doneEvent.confidence_gap !== undefined && (
                  <StatTile
                    label="Confidence − accuracy"
                    value={`${doneEvent.confidence_gap >= 0 ? '+' : ''}${decimal(doneEvent.confidence_gap)}`}
                    accent={calibrationAccent(doneEvent.confidence_gap)}
                  />
                )}
              </div>
            </>
          ) : (
            <p className="hint-text hint-text--spaced">
              Min-cut returns a hard partition, so there is no posterior to score. Run harmonic for
              calibration, AUROC, and margin.
            </p>
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
