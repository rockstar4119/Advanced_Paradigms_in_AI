import { useCallback, useEffect, useState } from 'react'
import { rangeProgress } from '../lib/ui'
import type { PropagationStreamEvent } from '../types'

interface PlaybackControlsProps {
  history: PropagationStreamEvent[]
  playheadIndex: number
  onChange: (index: number) => void
  isRunning: boolean
}

/**
 * Base dwell per step. The socket delivers a whole run in well under a second,
 * so the timeline — not the wire — decides how fast the algorithm reads.
 */
const BASE_STEP_MS = 110

/**
 * Some steps carry more meaning than others and deserve to be held. The min-cut
 * reveal in particular *is* the algorithm's answer; at one base tick it flashed
 * past between the last augmenting path and the final colouring.
 */
const DWELL: Partial<Record<PropagationStreamEvent['type'], number>> = {
  mincut_found: 5,
  augment_path: 1.4,
}

const SPEEDS = [0.5, 1, 2, 4]

function StepBackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  )
}

function StepForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  )
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}

export function PlaybackControls({ history, playheadIndex, onChange, isRunning }: PlaybackControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const historyLength = history.length
  const maxIndex = Math.max(0, historyLength - 1)
  const atEnd = playheadIndex >= maxIndex

  // A run plays itself. Previously the playhead was slammed to the newest event
  // while `isRunning`, which meant min-cut never advanced onto its own `done`
  // step (the flag clears in the same batch the event lands in) and the user had
  // to press play to see the result of a run that had already finished.
  useEffect(() => {
    if (isRunning) setIsPlaying(true)
  }, [isRunning])

  useEffect(() => {
    if (!isPlaying) return
    if (playheadIndex >= historyLength - 1) {
      // Caught up. If the stream is still open, wait for the next event;
      // if it has closed, this is the true end of the run.
      if (!isRunning) setIsPlaying(false)
      return
    }
    const current = history[playheadIndex]
    const dwell = (BASE_STEP_MS * (DWELL[current?.type] ?? 1)) / speed
    const timer = setTimeout(() => onChange(playheadIndex + 1), dwell)
    return () => clearTimeout(timer)
  }, [isPlaying, playheadIndex, history, historyLength, isRunning, speed, onChange])

  // Any manual move is a request to stop following the run and stay put.
  const scrub = useCallback(
    (index: number) => {
      setIsPlaying(false)
      onChange(Math.max(0, Math.min(maxIndex, index)))
    },
    [maxIndex, onChange],
  )

  const togglePlay = useCallback(() => {
    setIsPlaying((playing) => {
      if (playing) return false
      // Pressing play at the very end replays the run from the start.
      if (playheadIndex >= maxIndex && historyLength > 0) onChange(0)
      return true
    })
  }, [playheadIndex, maxIndex, historyLength, onChange])

  return (
    <div className="playback-controls">
      <button
        className="transport-btn"
        onClick={() => scrub(0)}
        disabled={playheadIndex <= 0}
        aria-label="Back to start"
      >
        <RestartIcon />
      </button>
      <button
        className="transport-btn"
        onClick={() => scrub(playheadIndex - 1)}
        disabled={playheadIndex <= 0}
        aria-label="Step back"
      >
        <StepBackIcon />
      </button>
      <button
        className="transport-btn primary"
        onClick={togglePlay}
        disabled={historyLength === 0}
        aria-label={isPlaying ? 'Pause' : atEnd ? 'Replay' : 'Play'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        className="transport-btn"
        onClick={() => scrub(playheadIndex + 1)}
        disabled={playheadIndex >= maxIndex}
        aria-label="Step forward"
      >
        <StepForwardIcon />
      </button>
      <input
        type="range"
        min={0}
        max={maxIndex}
        value={playheadIndex}
        style={rangeProgress(playheadIndex, 0, maxIndex || 1)}
        onChange={(e) => scrub(Number(e.target.value))}
        aria-label="Timeline"
      />
      <button
        className="speed-btn"
        onClick={() => setSpeed((current) => SPEEDS[(SPEEDS.indexOf(current) + 1) % SPEEDS.length])}
        aria-label={`Playback speed ${speed}x`}
        title="Playback speed"
      >
        {speed}×
      </button>
      <span className="playback-count">{historyLength ? `${playheadIndex + 1} / ${historyLength}` : '0 / 0'}</span>
    </div>
  )
}
