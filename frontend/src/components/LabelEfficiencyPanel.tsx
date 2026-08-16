import { useEffect, useState } from 'react'
import { apiClient } from '../lib/api'
import { EfficiencyChart } from './EfficiencyChart'
import { Spinner } from './Spinner'
import type { EfficiencyPoint } from '../types'

const FRACTIONS = [0.02, 0.05, 0.1, 0.2, 0.35, 0.5]

interface LabelEfficiencyPanelProps {
  sessionId: string | null
  graphReady: boolean
}

export function LabelEfficiencyPanel({ sessionId, graphReady }: LabelEfficiencyPanelProps) {
  const [points, setPoints] = useState<EfficiencyPoint[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPoints([])
    setError(null)
  }, [sessionId])

  const runSweep = async () => {
    if (!sessionId) return
    setIsRunning(true)
    setError(null)
    try {
      const response = await apiClient.runLabelEfficiency(sessionId, FRACTIONS)
      setPoints(response.points)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sweep failed')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Label efficiency</h2>
      </div>
      <p className="hint-text" style={{ marginBottom: 12 }}>
        Sweeps this exact graph across label fractions with harmonic propagation — how few labels does it actually need?
      </p>
      <button onClick={runSweep} disabled={!graphReady || isRunning}>
        {isRunning && <Spinner />}
        {isRunning ? 'Sweeping…' : 'Run efficiency sweep'}
      </button>
      {error && <p className="error-text">{error}</p>}
      {points.length > 0 && <EfficiencyChart points={points} />}
    </section>
  )
}
