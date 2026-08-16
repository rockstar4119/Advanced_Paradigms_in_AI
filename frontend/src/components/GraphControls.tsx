import { useState } from 'react'
import { rangeProgress } from '../lib/ui'
import { Spinner } from './Spinner'
import type { GraphBuildParams, GraphMethod } from '../types'

const K_RANGE = { min: 1, max: 20 }
const SIGMA_RANGE = { min: 0.1, max: 3 }
const SPARSIFY_RANGE = { min: 0, max: 0.5 }

interface GraphControlsProps {
  onBuild: (params: GraphBuildParams) => void
  isBuilding: boolean
  disabled?: boolean
}

export function GraphControls({ onBuild, isBuilding, disabled }: GraphControlsProps) {
  const [method, setMethod] = useState<GraphMethod>('knn')
  const [k, setK] = useState(6)
  const [sigma, setSigma] = useState(1.0)
  const [mutual, setMutual] = useState(false)
  const [sparsifyThreshold, setSparsifyThreshold] = useState(0.05)

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-index">2</span>
        <h2>Graph construction</h2>
      </div>

      <div className="field select-field">
        <div className="field-row">
          <span className="field-label">Method</span>
        </div>
        <select value={method} onChange={(e) => setMethod(e.target.value as GraphMethod)}>
          <option value="knn">Weighted k-NN</option>
          <option value="rbf">RBF (fully connected)</option>
        </select>
      </div>

      {method === 'knn' && (
        <>
          <div className="field">
            <div className="field-row">
              <span className="field-label">k</span>
              <span className="field-value">{k}</span>
            </div>
            <input
              type="range"
              min={K_RANGE.min}
              max={K_RANGE.max}
              value={k}
              style={rangeProgress(k, K_RANGE.min, K_RANGE.max)}
              onChange={(e) => setK(Number(e.target.value))}
            />
          </div>
          <label className="toggle-row">
            <span className="field-label">Mutual neighbors only</span>
            <input type="checkbox" className="toggle" checked={mutual} onChange={(e) => setMutual(e.target.checked)} />
          </label>
        </>
      )}

      {method === 'rbf' && (
        <div className="field">
          <div className="field-row">
            <span className="field-label">Sparsify threshold</span>
            <span className="field-value">{sparsifyThreshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={SPARSIFY_RANGE.min}
            max={SPARSIFY_RANGE.max}
            step={0.01}
            value={sparsifyThreshold}
            style={rangeProgress(sparsifyThreshold, SPARSIFY_RANGE.min, SPARSIFY_RANGE.max)}
            onChange={(e) => setSparsifyThreshold(Number(e.target.value))}
          />
        </div>
      )}

      <div className="field">
        <div className="field-row">
          <span className="field-label">σ (sigma)</span>
          <span className="field-value">{sigma.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={SIGMA_RANGE.min}
          max={SIGMA_RANGE.max}
          step={0.05}
          value={sigma}
          style={rangeProgress(sigma, SIGMA_RANGE.min, SIGMA_RANGE.max)}
          onChange={(e) => setSigma(Number(e.target.value))}
        />
      </div>

      <button
        onClick={() => onBuild({ method, k, sigma, mutual, sparsify_threshold: sparsifyThreshold })}
        disabled={isBuilding || disabled}
      >
        {isBuilding && <Spinner />}
        {isBuilding ? 'Building…' : 'Build graph'}
      </button>
    </section>
  )
}
