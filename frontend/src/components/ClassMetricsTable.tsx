import { classColor } from '../lib/colors'
import type { ClassMetric } from '../types'

export function ClassMetricsTable({ perClass }: { perClass: ClassMetric[] }) {
  return (
    <div className="class-metrics">
      <p className="matrix-caption">Per-class performance</p>
      <div className="matrix-wrap">
        <table className="metrics-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Precision</th>
              <th>Recall</th>
              <th>F1</th>
              <th>n</th>
            </tr>
          </thead>
          <tbody>
            {perClass.map((m) => (
              <tr key={m.class_index}>
                <td className="class-cell">
                  <span className="swatch" style={{ backgroundColor: classColor(m.class_index) }} />
                  {m.class_index}
                </td>
                <td>{(m.precision * 100).toFixed(0)}%</td>
                <td>{(m.recall * 100).toFixed(0)}%</td>
                <td>{(m.f1 * 100).toFixed(0)}%</td>
                <td>{m.support}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
