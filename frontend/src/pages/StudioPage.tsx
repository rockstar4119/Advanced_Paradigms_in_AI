import { useEffect, useState } from 'react'
import { AlgorithmControls } from '../components/AlgorithmControls'
import { ComparisonPanel } from '../components/ComparisonPanel'
import { DatasetSelector } from '../components/DatasetSelector'
import { GraphCanvas } from '../components/GraphCanvas'
import { GraphControls } from '../components/GraphControls'
import { GraphDiagnosticsPanel } from '../components/GraphDiagnosticsPanel'
import { GraphStatsPanel } from '../components/GraphStatsPanel'
import { LabelEfficiencyPanel } from '../components/LabelEfficiencyPanel'
import { MetricsPanel } from '../components/MetricsPanel'
import { NodeInspector } from '../components/NodeInspector'
import { PlaybackControls } from '../components/PlaybackControls'
import { ResultDiagnosticsPanel } from '../components/ResultDiagnosticsPanel'
import { TelemetryStrip } from '../components/TelemetryStrip'
import { useGraphBuild } from '../hooks/useGraphBuild'
import { useGraphStore } from '../hooks/useGraphStore'
import { usePropagation } from '../hooks/usePropagation'
import type { Algorithm, DoneEvent } from '../types'

type InterpTab = 'all' | 'node-graph' | 'results' | 'comparison'

export function StudioPage() {
  const sessionId = useGraphStore((state) => state.sessionId)
  const setGraphReady = useGraphStore((state) => state.setGraphReady)
  const graphReady = useGraphStore((state) => state.graphReady)
  const inspectedNode = useGraphStore((state) => state.inspectedNode)

  const graphBuild = useGraphBuild(sessionId)
  const propagation = usePropagation(sessionId)
  const [playheadIndex, setPlayheadIndex] = useState(0)
  const [results, setResults] = useState<Partial<Record<Algorithm, DoneEvent>>>({})
  const [activeTab, setActiveTab] = useState<InterpTab>('all')

  useEffect(() => {
    if (graphBuild.edgeCount !== null) setGraphReady(true)
  }, [graphBuild.edgeCount, setGraphReady])

  useEffect(() => {
    if (propagation.history.length === 0) setPlayheadIndex(0)
  }, [propagation.history.length])

  useEffect(() => {
    setResults({})
  }, [sessionId])

  useEffect(() => {
    if (inspectedNode !== null && activeTab !== 'all' && activeTab !== 'node-graph') {
      setActiveTab('node-graph')
    }
  }, [inspectedNode])

  const doneEvent = propagation.history.find((event) => event.type === 'done') as DoneEvent | undefined

  useEffect(() => {
    if (doneEvent && propagation.lastParams) {
      const algorithm = propagation.lastParams.algorithm
      setResults((prev) => ({ ...prev, [algorithm]: doneEvent }))
    }
  }, [doneEvent])

  return (
    <div className="app-shell">
      <aside className="control-rail">
        <DatasetSelector />
        <GraphControls onBuild={graphBuild.build} isBuilding={graphBuild.isBuilding} disabled={!sessionId} />
        <AlgorithmControls onRun={propagation.run} disabled={!graphReady} isRunning={propagation.isRunning} />
      </aside>

      <main className="stage">
        <GraphCanvas edges={graphBuild.edges} history={propagation.history} playheadIndex={playheadIndex} />
        <TelemetryStrip history={propagation.history} playheadIndex={playheadIndex} isRunning={propagation.isRunning} />
        <PlaybackControls
          historyLength={propagation.history.length}
          playheadIndex={playheadIndex}
          onChange={setPlayheadIndex}
          isRunning={propagation.isRunning}
        />

        <section className="interpretability-section">
          <header className="interp-header">
            <div>
              <h2 className="interp-title">Interpretability & Diagnostics</h2>
              <p className="interp-sub">Live model explanations, graph homophily, seed attributions, and calibration metrics</p>
            </div>
            <div className="interp-tabs">
              <button
                type="button"
                className={`interp-tab${activeTab === 'all' ? ' active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All Diagnostics
              </button>
              <button
                type="button"
                className={`interp-tab${activeTab === 'node-graph' ? ' active' : ''}`}
                onClick={() => setActiveTab('node-graph')}
              >
                Node & Graph {inspectedNode !== null ? `(Node ${inspectedNode})` : ''}
              </button>
              <button
                type="button"
                className={`interp-tab${activeTab === 'results' ? ' active' : ''}`}
                onClick={() => setActiveTab('results')}
              >
                Results & Errors
              </button>
              <button
                type="button"
                className={`interp-tab${activeTab === 'comparison' ? ' active' : ''}`}
                onClick={() => setActiveTab('comparison')}
              >
                Comparison & Sweep
              </button>
            </div>
          </header>

          <div className="interp-content">
            {(activeTab === 'all' || activeTab === 'node-graph') && (
              <div className="interp-col">
                <NodeInspector sessionId={sessionId} graphReady={graphReady} edgeCount={graphBuild.edgeCount} />
                <GraphDiagnosticsPanel sessionId={sessionId} graphReady={graphReady} edgeCount={graphBuild.edgeCount} />
                <GraphStatsPanel stats={graphBuild.stats} />
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'results') && (
              <div className="interp-col">
                <ResultDiagnosticsPanel sessionId={sessionId} doneEvent={doneEvent} />
                <MetricsPanel doneEvent={doneEvent} history={propagation.history} playheadIndex={playheadIndex} />
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'comparison') && (
              <div className="interp-col">
                <ComparisonPanel results={results} />
                <LabelEfficiencyPanel sessionId={sessionId} graphReady={graphReady} />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
