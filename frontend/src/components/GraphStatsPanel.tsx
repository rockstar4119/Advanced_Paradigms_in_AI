import type { GraphStats } from '../hooks/useGraphBuild'
import { StatTile } from './StatTile'

export function GraphStatsPanel({ stats }: { stats: GraphStats | null }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Graph statistics</h2>
      </div>

      {!stats && <p className="hint-text">Build a graph to see structural stats.</p>}

      {stats && (
        <>
          <div className="stat-grid">
            <StatTile label="Density" value={`${(stats.density * 100).toFixed(1)}%`} />
            <StatTile label="Avg degree" value={stats.avgDegree.toFixed(1)} />
            <StatTile
              label="Components"
              value={String(stats.nComponents)}
              accent={stats.nComponents > 1 ? 'var(--error)' : undefined}
            />
            <StatTile label="Connectivity λ₂" value={stats.algebraicConnectivity.toFixed(3)} />
          </div>
          {stats.nComponents > 1 && (
            <p className="stat-warning">
              Fragmented into {stats.nComponents} components — labels can't reach the other side. Try RBF or a larger k.
            </p>
          )}
        </>
      )}
    </section>
  )
}
