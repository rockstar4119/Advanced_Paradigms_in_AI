import { useEffect, useState } from 'react'
import { apiClient } from '../lib/api'
import { CLASS_COLORS } from '../lib/colors'
import { Histogram } from './Histogram'
import { Spinner } from './Spinner'
import { StatTile } from './StatTile'
import type { GraphExplanation } from '../types'

interface GraphDiagnosticsPanelProps {
  sessionId: string | null
  graphReady: boolean
  edgeCount: number | null
}

/**
 * Answers the only question that matters about a freshly built graph: can
 * propagation possibly succeed on it? Homophily is the headline — the share of
 * edge weight that joins two nodes of the same true class.
 */
export function GraphDiagnosticsPanel({ sessionId, graphReady, edgeCount }: GraphDiagnosticsPanelProps) {
  const [data, setData] = useState<GraphExplanation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!sessionId || !graphReady) {
      setData(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    apiClient
      .explainGraph(sessionId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Diagnostics failed')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // edgeCount changes on every rebuild, which is exactly when this goes stale
  }, [sessionId, graphReady, edgeCount])

  const homophily = data ? data.homophily_weighted : 0
  const unlabelledComponents = data?.components.filter((c) => c.n_labeled === 0) ?? []

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Graph diagnostics</h2>
        {isLoading && <Spinner />}
      </div>

      {!graphReady && <p className="hint-text">Build a graph to diagnose whether it can carry labels.</p>}
      {error && <p className="error-text">{error}</p>}

      {data && (
        <>
          <div className="ceiling-block">
            <div className="ceiling-head">
              <span className="ceiling-label">Homophily</span>
              <span className="ceiling-value">{(homophily * 100).toFixed(1)}%</span>
            </div>
            <div className="ceiling-track">
              <div className="ceiling-fill" style={{ width: `${homophily * 100}%` }} />
            </div>
            <p className="ceiling-note">
              Share of edge weight joining two nodes of the <em>same</em> true class. Labels travel
              along edges, so the {(data.cross_class_weight_fraction * 100).toFixed(1)}% that crosses
              classes is the weight actively pushing predictions the wrong way.
            </p>
          </div>

          <div className="stat-grid">
            <StatTile label="Cross-class edges" value={String(data.n_cross_class_edges)} />
            <StatTile
              label="Isolated nodes"
              value={String(data.isolated_nodes.length)}
              accent={data.isolated_nodes.length > 0 ? 'var(--error)' : undefined}
            />
            <StatTile
              label="Unreachable"
              value={String(data.n_unreachable)}
              accent={data.n_unreachable > 0 ? 'var(--error)' : undefined}
            />
            <StatTile label="Components" value={String(data.components.length)} />
          </div>

          {data.n_unreachable > 0 && (
            <p className="stat-warning">
              {data.n_unreachable} node{data.n_unreachable === 1 ? '' : 's'} cannot reach any labeled
              node. Their predictions are arbitrary, not inferred
              {unlabelledComponents.length > 0 &&
                ` — ${unlabelledComponents.length} component${unlabelledComponents.length === 1 ? '' : 's'} contain no labels at all`}
              .
            </p>
          )}

          <p className="matrix-caption matrix-caption--spaced">Degree distribution</p>
          <Histogram histogram={data.degree_histogram} format={(v) => v.toFixed(1)} />

          <p className="matrix-caption matrix-caption--spaced">Edge weight distribution</p>
          <Histogram histogram={data.weight_histogram} format={(v) => v.toFixed(2)} />

          {data.top_leaks.length > 0 && (
            <>
              <p className="matrix-caption matrix-caption--spaced">Heaviest label leaks</p>
              <ul className="leak-list">
                {data.top_leaks.slice(0, 5).map((leak) => (
                  <li key={`${leak.source}-${leak.target}`}>
                    <span className="leak-pair">
                      <span className="swatch" style={{ background: CLASS_COLORS[leak.source_class % CLASS_COLORS.length] }} />
                      {leak.source}
                      <span className="leak-arrow">↔</span>
                      {leak.target}
                      <span className="swatch" style={{ background: CLASS_COLORS[leak.target_class % CLASS_COLORS.length] }} />
                    </span>
                    <span className="leak-weight">{leak.weight.toFixed(3)}</span>
                  </li>
                ))}
              </ul>
              <p className="hint-text" style={{ marginTop: 8, fontSize: '0.74rem' }}>
                These edges connect different true classes at high weight — the specific paths errors
                will travel along.
              </p>
            </>
          )}

          <p className="oracle-note">
            Uses ground-truth labels the algorithms never see — an evaluator's diagnostic, like
            accuracy. It tells you whether the graph <em>can</em> work, not what the model knows.
          </p>
        </>
      )}
    </section>
  )
}
