import { useEffect, useState } from 'react'
import { useGraphStore } from '../hooks/useGraphStore'
import { apiClient } from '../lib/api'
import { CLASS_COLORS, classColor } from '../lib/colors'
import { Spinner } from './Spinner'
import type { NodeExplanation } from '../types'

interface NodeInspectorProps {
  sessionId: string | null
  graphReady: boolean
  edgeCount: number | null
}

/**
 * Exact attribution for one node. Because the harmonic solution is
 * f_U = (I - P_UU)^-1 P_UL f_L, every prediction decomposes into the labeled
 * seeds that produced it, with masses summing to 1 — this is the model itself,
 * not a surrogate explanation fitted to it.
 */
export function NodeInspector({ sessionId, graphReady, edgeCount }: NodeInspectorProps) {
  const inspectedNode = useGraphStore((state) => state.inspectedNode)
  const setInspectedNode = useGraphStore((state) => state.setInspectedNode)

  const [data, setData] = useState<NodeExplanation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!sessionId || !graphReady || inspectedNode === null) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    apiClient
      .explainNode(sessionId, inspectedNode)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Explanation failed')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, graphReady, inspectedNode, edgeCount])

  const correct = data ? data.predicted === data.true_label : false
  const topMass = data ? Math.max(...data.top_seeds.map((s) => s.mass), 1e-9) : 1

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Node inspector</h2>
        {isLoading && <Spinner />}
        {inspectedNode !== null && (
          <button className="link-button" onClick={() => setInspectedNode(null)}>
            clear
          </button>
        )}
      </div>

      {inspectedNode === null && (
        <p className="hint-text">
          Click any node on the canvas to see exactly which labeled seeds produced its prediction.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}

      {data && (
        <>
          <div className="inspector-head">
            <span className="inspector-id">node {data.node_id}</span>
            <span className={`inspector-verdict${correct ? ' correct' : ' wrong'}`}>
              {correct ? 'correct' : 'wrong'}
            </span>
          </div>

          <div className="inspector-labels">
            <div>
              <span className="stat-tile-label">Predicted</span>
              <span className="inspector-class">
                <span className="swatch" style={{ background: classColor(data.predicted) }} />
                class {data.predicted}
              </span>
            </div>
            <div>
              <span className="stat-tile-label">Truth</span>
              <span className="inspector-class">
                <span className="swatch" style={{ background: classColor(data.true_label) }} />
                class {data.true_label}
              </span>
            </div>
          </div>

          <div className="stat-grid">
            <StatMini label="Uncertainty" value={`${data.entropy.toFixed(2)} bits`} />
            <StatMini label="Margin" value={data.margin.toFixed(3)} />
            <StatMini label="Degree" value={data.degree.toFixed(2)} />
            <StatMini label="Neighbours" value={String(data.n_neighbors)} />
          </div>

          {!data.reachable && (
            <p className="stat-warning">
              This node has no path to any labeled node. Its prediction is a tie-break, not an
              inference.
            </p>
          )}

          <p className="matrix-caption matrix-caption--spaced">Where its label came from</p>
          <ul className="seed-list">
            {data.top_seeds.map((seed) => (
              <li key={seed.seed_node}>
                <span className="seed-id">
                  <span className="swatch" style={{ background: classColor(seed.seed_class) }} />
                  seed {seed.seed_node}
                </span>
                <span className="seed-bar">
                  <span
                    className="seed-fill"
                    style={{
                      width: `${(seed.mass / topMass) * 100}%`,
                      background: classColor(seed.seed_class),
                    }}
                  />
                </span>
                <span className="seed-mass">{(seed.mass * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>

          <p className="matrix-caption matrix-caption--spaced">Absorption mass by class</p>
          <div className="class-mass-bar">
            {data.class_mass.map((mass, index) => (
              <span
                key={index}
                className="class-mass-segment"
                style={{ width: `${mass * 100}%`, background: CLASS_COLORS[index % CLASS_COLORS.length] }}
                title={`class ${index}: ${(mass * 100).toFixed(1)}%`}
              />
            ))}
          </div>

          <p className="oracle-note">
            A random walk leaving this node is absorbed at seed <em>s</em> with the probability
            shown. The masses are the model's own arithmetic and sum to 100%.
          </p>
        </>
      )}
    </section>
  )
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-value">{value}</span>
      <span className="stat-tile-label">{label}</span>
    </div>
  )
}
