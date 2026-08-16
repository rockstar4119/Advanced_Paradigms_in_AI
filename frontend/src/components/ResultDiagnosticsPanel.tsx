import { useEffect, useState } from 'react'
import { apiClient } from '../lib/api'
import { classColor } from '../lib/colors'
import { CalibrationChart } from './CalibrationChart'
import { RiskCoverageChart } from './RiskCoverageChart'
import { Spinner } from './Spinner'
import { StatTile } from './StatTile'
import type { DoneEvent, ResultExplanation } from '../types'

interface ResultDiagnosticsPanelProps {
  sessionId: string | null
  doneEvent: DoneEvent | undefined
}

/**
 * The three questions a practitioner asks about a finished run: is the
 * confidence honest, what do I get if I only accept confident predictions,
 * and what do the mistakes have in common?
 */
export function ResultDiagnosticsPanel({ sessionId, doneEvent }: ResultDiagnosticsPanelProps) {
  const [data, setData] = useState<ResultExplanation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!sessionId || !doneEvent) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    apiClient
      .explainResult(sessionId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setData(null)
          setError(err instanceof Error ? err.message : 'Diagnostics failed')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, doneEvent])

  const profile = data?.error_profile
  const headroom = data ? data.homophily_ceiling - data.accuracy : 0

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Result diagnostics</h2>
        {isLoading && <Spinner />}
      </div>

      {!doneEvent && <p className="hint-text">Run a propagation to analyse its confidence and errors.</p>}
      {error && <p className="hint-text">{error}</p>}

      {data && profile && (
        <>
          <div className="stat-grid">
            <StatTile label="Accuracy" value={data.accuracy.toFixed(3)} />
            <StatTile label="Homophily" value={data.homophily_ceiling.toFixed(3)} />
            <StatTile
              label="Calibration err"
              value={data.expected_calibration_error.toFixed(3)}
              accent={data.expected_calibration_error > 0.15 ? 'var(--error)' : undefined}
            />
            <StatTile label="Errors" value={String(profile.n_errors)} />
          </div>

          <p className="headroom-note">
            {headroom > 0.02
              ? `${(headroom * 100).toFixed(1)} points below the graph's homophily — there is structure left on the table. Try tuning σ or k before buying more labels.`
              : `Accuracy is at the graph's homophily. Further gains need a better graph, not more labels.`}
          </p>

          <p className="matrix-caption matrix-caption--spaced">Reliability — is the confidence honest?</p>
          <CalibrationChart bins={data.calibration} />

          <p className="matrix-caption matrix-caption--spaced">
            Selective prediction — accuracy if you only accept confident nodes
          </p>
          <RiskCoverageChart points={data.risk_coverage} baseline={data.accuracy} />

          <p className="matrix-caption matrix-caption--spaced">What the mistakes have in common</p>
          <table className="metrics-table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Correct</th>
                <th>Wrong</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="class-cell">Mean margin</td>
                <td>{profile.mean_margin_correct.toFixed(3)}</td>
                <td>{profile.mean_margin_error.toFixed(3)}</td>
              </tr>
              <tr>
                <td className="class-cell">Local homophily</td>
                <td>{profile.mean_homophily_correct.toFixed(3)}</td>
                <td>{profile.mean_homophily_error.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
          <p className="hint-text" style={{ marginTop: 8, fontSize: '0.74rem' }}>
            {(profile.errors_in_lowest_margin_quartile * 100).toFixed(0)}% of errors sit in the
            lowest-margin quartile
            {profile.unreachable_errors > 0 && `, and ${profile.unreachable_errors} are unreachable nodes`}
            . Low margin and low local homophily are the two signals that predict a mistake — both
            are computable without ground truth.
          </p>

          {data.confident_errors.length > 0 && (
            <>
              <p className="matrix-caption matrix-caption--spaced">Confidently wrong</p>
              <ul className="leak-list">
                {data.confident_errors.slice(0, 5).map((item) => (
                  <li key={item.node_id}>
                    <span className="leak-pair">
                      node {item.node_id}
                      <span className="swatch" style={{ background: classColor(item.predicted) }} />
                      <span className="leak-arrow">not</span>
                      <span className="swatch" style={{ background: classColor(item.true_label) }} />
                    </span>
                    <span className="leak-weight">{(item.confidence * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
              <p className="hint-text" style={{ marginTop: 8, fontSize: '0.74rem' }}>
                The graph actively misleads here — these nodes sit in neighbourhoods dominated by the
                wrong class. Click one on the canvas to see which seeds pulled it across.
              </p>
            </>
          )}
        </>
      )}
    </section>
  )
}
