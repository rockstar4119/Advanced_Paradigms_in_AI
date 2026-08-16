import { useState } from 'react'
import { rangeProgress } from '../lib/ui'
import { useGraphStore } from '../hooks/useGraphStore'
import { Spinner } from './Spinner'
import type { Algorithm, PropagationRunParams } from '../types'

const MAX_ITER_RANGE = { min: 10, max: 500 }
const TOL_RANGE = { min: 0.00001, max: 0.01 }

interface AlgorithmControlsProps {
  onRun: (params: PropagationRunParams) => void
  disabled: boolean
  isRunning: boolean
}

export function AlgorithmControls({ onRun, disabled, isRunning }: AlgorithmControlsProps) {
  const nClasses = useGraphStore((state) => state.nClasses)
  const [algorithm, setAlgorithm] = useState<Algorithm>('harmonic')
  const [maxIter, setMaxIter] = useState(200)
  const [tol, setTol] = useState(0.0001)
  const [sourceClass, setSourceClass] = useState(0)
  const [sinkClass, setSinkClass] = useState(1)

  const classOptions = Array.from({ length: nClasses }, (_, i) => i)

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-index">3</span>
        <h2>Label propagation</h2>
      </div>

      <div className="field select-field">
        <div className="field-row">
          <span className="field-label">Algorithm</span>
        </div>
        <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value as Algorithm)}>
          <option value="harmonic">Harmonic energy minimization</option>
          <option value="mincut">Graph mincut</option>
        </select>
      </div>

      {algorithm === 'harmonic' && (
        <>
          <div className="field">
            <div className="field-row">
              <span className="field-label">Max iterations</span>
              <span className="field-value">{maxIter}</span>
            </div>
            <input
              type="range"
              min={MAX_ITER_RANGE.min}
              max={MAX_ITER_RANGE.max}
              value={maxIter}
              style={rangeProgress(maxIter, MAX_ITER_RANGE.min, MAX_ITER_RANGE.max)}
              onChange={(e) => setMaxIter(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <div className="field-row">
              <span className="field-label">Tolerance</span>
              <span className="field-value">{tol}</span>
            </div>
            <input
              type="range"
              min={TOL_RANGE.min}
              max={TOL_RANGE.max}
              step={0.00001}
              value={tol}
              style={rangeProgress(tol, TOL_RANGE.min, TOL_RANGE.max)}
              onChange={(e) => setTol(Number(e.target.value))}
            />
          </div>
        </>
      )}

      {algorithm === 'mincut' && (
        <>
          <div className="field select-field">
            <div className="field-row">
              <span className="field-label">Source class</span>
            </div>
            <select value={sourceClass} onChange={(e) => setSourceClass(Number(e.target.value))}>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field select-field">
            <div className="field-row">
              <span className="field-label">Sink class</span>
            </div>
            <select value={sinkClass} onChange={(e) => setSinkClass(Number(e.target.value))}>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <button
        onClick={() => onRun({ algorithm, max_iter: maxIter, tol, source_class: sourceClass, sink_class: sinkClass })}
        disabled={disabled || isRunning}
      >
        {isRunning && <Spinner />}
        {isRunning ? 'Running…' : 'Run propagation'}
      </button>
      {disabled && <p className="hint-text" style={{ marginTop: 10 }}>Build a graph first.</p>}
    </section>
  )
}
