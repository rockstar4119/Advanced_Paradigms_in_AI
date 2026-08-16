import type { Algorithm, DoneEvent } from '../types'

const ALGO_LABEL: Record<Algorithm, string> = { harmonic: 'Harmonic', mincut: 'Mincut' }

interface ComparisonPanelProps {
  results: Partial<Record<Algorithm, DoneEvent>>
}

export function ComparisonPanel({ results }: ComparisonPanelProps) {
  const entries = Object.entries(results) as [Algorithm, DoneEvent][]

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Algorithm comparison</h2>
      </div>

      {entries.length < 2 && (
        <p className="hint-text">Run both harmonic and mincut on this graph to compare their final accuracy.</p>
      )}

      {entries.length >= 2 && (
        <div className="compare-bars">
          {entries.map(([algo, event]) => (
            <div key={algo} className="compare-row">
              <div className="compare-label">
                <span>{ALGO_LABEL[algo]}</span>
                <span className="field-value">{(event.accuracy * 100).toFixed(1)}%</span>
              </div>
              <div className="compare-track">
                <div className="compare-fill" style={{ width: `${Math.max(2, event.accuracy * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
