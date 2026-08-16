import { useCallback, useEffect, useMemo, useState } from 'react'
import { FieldLegend, FieldView, type FieldMode } from '../components/arena/FieldView'
import { RaceChart } from '../components/arena/RaceChart'
import { Spinner } from '../components/Spinner'
import { useGraphStore } from '../hooks/useGraphStore'
import { apiClient } from '../lib/api'
import { rangeProgress } from '../lib/ui'
import type { AcquisitionStrategy, ArenaState } from '../types'

const STRATEGY_COPY: Record<AcquisitionStrategy, { name: string; blurb: string }> = {
  entropy: {
    name: 'Max entropy',
    blurb: 'Buy the label for whichever node the model is least sure about.',
  },
  margin: {
    name: 'Min margin',
    blurb: 'Buy where the top two classes are closest — the decision boundary itself.',
  },
  density_entropy: {
    name: 'Density-weighted',
    blurb: 'Uncertainty × degree, so a confused node with many neighbours wins over a confused loner.',
  },
  random: {
    name: 'Random',
    blurb: 'The control condition, racing against itself.',
  },
}

const MODES: [FieldMode, string][] = [
  ['prediction', 'Prediction'],
  ['uncertainty', 'Uncertainty'],
  ['error', 'Errors'],
]

export function ArenaPage() {
  const sessionId = useGraphStore((state) => state.sessionId)
  const graphReady = useGraphStore((state) => state.graphReady)
  const nodes = useGraphStore((state) => state.nodes)

  const [state, setState] = useState<ArenaState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [autoRun, setAutoRun] = useState(false)

  const [batchSize, setBatchSize] = useState(4)
  const [strategy, setStrategy] = useState<AcquisitionStrategy>('entropy')
  const [holdout, setHoldout] = useState(0.3)
  const [mode, setMode] = useState<FieldMode>('prediction')

  useEffect(() => {
    setState(null)
    setAutoRun(false)
    setError(null)
  }, [sessionId])

  const start = async () => {
    if (!sessionId) return
    setIsBusy(true)
    setError(null)
    setAutoRun(false)
    try {
      setState(await apiClient.startArena(sessionId, {
        batch_size: batchSize,
        strategy,
        holdout_fraction: holdout,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the arena')
    } finally {
      setIsBusy(false)
    }
  }

  const step = useCallback(async () => {
    if (!sessionId) return
    setIsBusy(true)
    try {
      setState(await apiClient.stepArena(sessionId))
    } catch (err) {
      setAutoRun(false)
      setError(err instanceof Error ? err.message : 'Round failed')
    } finally {
      setIsBusy(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (!autoRun || isBusy || !state || state.exhausted) return
    const timer = window.setTimeout(step, 420)
    return () => window.clearTimeout(timer)
  }, [autoRun, isBusy, state, step])

  const reset = async () => {
    if (!sessionId) return
    setAutoRun(false)
    await apiClient.resetArena(sessionId)
    setState(null)
  }

  const guided = state?.tracks.guided
  const random = state?.tracks.random
  const gap = guided && random ? guided.accuracy - random.accuracy : 0
  const suggestionIds = useMemo(() => state?.suggestions.map((s) => s.node_id) ?? [], [state])

  if (!sessionId || !graphReady) {
    return (
      <div className="arena-page">
        <div className="arena-empty">
          <h2>The arena needs a graph</h2>
          <p>
            Generate a dataset and build a graph in the Studio first. The arena then spends a label
            budget on that exact graph — once guided by the model's own uncertainty, once at random —
            and races the two.
          </p>
          <a className="m-footer-cta" href="#/">
            Go to the studio →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="arena-page">
      <div className="arena-shell">
        <aside className="arena-rail">
          <section className="panel">
            <div className="panel-head">
              <h2>Setup</h2>
            </div>

            <div className="field">
              <div className="field-row">
                <span className="field-label">Acquisition</span>
              </div>
              <select
                value={strategy}
                onChange={(event) => setStrategy(event.target.value as AcquisitionStrategy)}
                disabled={Boolean(state)}
              >
                {(Object.keys(STRATEGY_COPY) as AcquisitionStrategy[])
                  .filter((key) => key !== 'random')
                  .map((key) => (
                    <option key={key} value={key}>
                      {STRATEGY_COPY[key].name}
                    </option>
                  ))}
              </select>
              <p className="hint-text" style={{ marginTop: 8, fontSize: '0.76rem' }}>
                {STRATEGY_COPY[strategy].blurb}
              </p>
            </div>

            <div className="field">
              <div className="field-row">
                <span className="field-label">Labels per round</span>
                <span className="field-value">{batchSize}</span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={batchSize}
                style={rangeProgress(batchSize, 1, 12)}
                disabled={Boolean(state)}
                onChange={(event) => setBatchSize(Number(event.target.value))}
              />
            </div>

            <div className="field">
              <div className="field-row">
                <span className="field-label">Held-out share</span>
                <span className="field-value">{(holdout * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.6}
                step={0.05}
                value={holdout}
                style={rangeProgress(holdout, 0.1, 0.6)}
                disabled={Boolean(state)}
                onChange={(event) => setHoldout(Number(event.target.value))}
              />
              <p className="hint-text" style={{ marginTop: 8, fontSize: '0.76rem' }}>
                Reserved before round one and never offered to either track, so the race measures
                the strategy rather than who labelled the test set.
              </p>
            </div>

            {!state ? (
              <button onClick={start} disabled={isBusy}>
                {isBusy && <Spinner />}
                {isBusy ? 'Setting up…' : 'Open the arena'}
              </button>
            ) : (
              <>
                <button onClick={step} disabled={isBusy || state.exhausted}>
                  {isBusy && <Spinner />}
                  Buy {state.batch_size} label{state.batch_size === 1 ? '' : 's'}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setAutoRun((prev) => !prev)}
                  disabled={state.exhausted}
                >
                  {autoRun ? 'Pause' : 'Auto-run rounds'}
                </button>
                <button className="secondary-button" onClick={reset}>
                  Reset arena
                </button>
              </>
            )}

            {error && <p className="error-text">{error}</p>}
          </section>

          {state && (
            <section className="panel">
              <div className="panel-head">
                <h2>The oracle says</h2>
              </div>
              {state.suggestions.length === 0 ? (
                <p className="hint-text">Pool exhausted — every purchasable node is labeled.</p>
              ) : (
                <>
                  <p className="hint-text" style={{ marginBottom: 12, fontSize: '0.78rem' }}>
                    Label these next, ranked by {STRATEGY_COPY[strategy].name.toLowerCase()}:
                  </p>
                  <ul className="oracle-list">
                    {state.suggestions.map((suggestion) => (
                      <li key={suggestion.node_id}>
                        <span className="oracle-node">node {suggestion.node_id}</span>
                        <span className="oracle-metrics">
                          H {suggestion.entropy.toFixed(2)} · m {suggestion.margin.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="oracle-note">
                    These are the model's own uncertainty scores — no ground truth involved in
                    choosing them. Watch where they land on the field.
                  </p>
                </>
              )}
            </section>
          )}
        </aside>

        <main className="arena-main">
          <header className="arena-head">
            <div>
              <h1>Active Learning Arena</h1>
              <p>
                One graph, two budgets. The model picks its own labels on the left track; the right
                track picks at random. Same graph, same batch size, same scoreboard.
              </p>
            </div>
            {state && (
              <div className="arena-round">
                <span className="arena-round-num">{state.round_index}</span>
                <span className="arena-round-label">round</span>
              </div>
            )}
          </header>

          {!state && (
            <div className="arena-placeholder">
              <p>Open the arena to start the race.</p>
            </div>
          )}

          {state && guided && random && (
            <>
              <section className="arena-scoreboard">
                <ScoreCard title="Guided" accent="#3987e5" track={guided} strategyLabel={STRATEGY_COPY[strategy].name} />
                <div className="arena-gap">
                  <span className={`arena-gap-value${gap > 0 ? ' positive' : gap < 0 ? ' negative' : ''}`}>
                    {gap >= 0 ? '+' : ''}
                    {(gap * 100).toFixed(1)}
                  </span>
                  <span className="arena-gap-label">points of accuracy, for the same budget</span>
                </div>
                <ScoreCard title="Random" accent="#d95926" track={random} strategyLabel="Uniform pick" />
              </section>

              <section className="arena-panel">
                <h3>Accuracy per label spent</h3>
                <RaceChart guided={guided.history} random={random.history} />
              </section>

              <section className="arena-panel">
                <div className="arena-panel-head">
                  <h3>The field — guided track</h3>
                  <div className="mode-tabs">
                    {MODES.map(([value, label]) => (
                      <button
                        key={value}
                        className={`mode-tab${mode === value ? ' active' : ''}`}
                        onClick={() => setMode(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <FieldView
                  nodes={nodes}
                  track={guided}
                  holdout={state.holdout}
                  suggestions={suggestionIds}
                  mode={mode}
                  nClasses={state.n_classes}
                />
                <FieldLegend mode={mode} nClasses={state.n_classes} />
                <p className="oracle-note">
                  Switch to <em>Uncertainty</em> and the ringed picks sit exactly where the two
                  classes meet. That is the whole thesis of active learning, visible in one frame:
                  a label spent at the boundary resolves far more of the graph than a label spent
                  inside a cluster that was never in doubt.
                </p>
              </section>

              {state.exhausted && (
                <p className="stat-warning">
                  Budget exhausted — every purchasable node has been labeled. Only the held-out
                  nodes remain unlabeled.
                </p>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function ScoreCard({
  title,
  accent,
  track,
  strategyLabel,
}: {
  title: string
  accent: string
  track: { accuracy: number; n_labels: number; mean_entropy: number }
  strategyLabel: string
}) {
  return (
    <div className="score-card" style={{ borderTopColor: accent }}>
      <span className="score-title">{title}</span>
      <span className="score-value" style={{ color: accent }}>
        {track.accuracy.toFixed(3)}
      </span>
      <span className="score-sub">{strategyLabel}</span>
      <div className="score-meta">
        <span>{track.n_labels} labels</span>
        <span>{track.mean_entropy.toFixed(2)} bits</span>
      </div>
    </div>
  )
}
