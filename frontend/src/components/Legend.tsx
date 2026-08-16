import { useGraphStore } from '../hooks/useGraphStore'
import { classColor, UNLABELED_COLOR } from '../lib/colors'

export function Legend({ inline = false }: { inline?: boolean }) {
  const nClasses = useGraphStore((state) => state.nClasses)
  const classes = Array.from({ length: nClasses }, (_, i) => i)

  if (inline) {
    return (
      <div className="canvas-legend">
        <ul className="legend-list">
          {classes.map((c) => (
            <li key={c} className="legend-pill">
              <span className="swatch" style={{ backgroundColor: classColor(c) }} />
              Class {c}
            </li>
          ))}
          <li className="legend-pill">
            <span className="swatch" style={{ backgroundColor: UNLABELED_COLOR }} />
            Unlabeled
          </li>
        </ul>
      </div>
    )
  }

  return (
    <section className="panel legend">
      <div className="panel-head">
        <h2>Legend</h2>
      </div>
      <ul className="legend-list">
        {classes.map((c) => (
          <li key={c} className="legend-pill">
            <span className="swatch" style={{ backgroundColor: classColor(c) }} />
            Class {c}
          </li>
        ))}
        <li className="legend-pill">
          <span className="swatch" style={{ backgroundColor: UNLABELED_COLOR }} />
          Unlabeled
        </li>
      </ul>
    </section>
  )
}
