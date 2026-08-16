import { useEffect, useState } from 'react'
import { rangeProgress } from '../lib/ui'

interface PlaybackControlsProps {
  historyLength: number
  playheadIndex: number
  onChange: (index: number) => void
  isRunning: boolean
}

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

export function PlaybackControls({ historyLength, playheadIndex, onChange, isRunning }: PlaybackControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (!isPlaying) return
    if (playheadIndex >= historyLength - 1) {
      setIsPlaying(false)
      return
    }
    const timer = setTimeout(() => onChange(playheadIndex + 1), 120)
    return () => clearTimeout(timer)
  }, [isPlaying, playheadIndex, historyLength, onChange])

  useEffect(() => {
    if (isRunning) onChange(historyLength - 1)
  }, [historyLength, isRunning, onChange])

  const maxIndex = Math.max(0, historyLength - 1)

  return (
    <div className="playback-controls">
      <button
        className="transport-btn"
        onClick={() => onChange(Math.max(0, playheadIndex - 1))}
        disabled={playheadIndex <= 0}
        aria-label="Step back"
      >
        <StepBackIcon />
      </button>
      <button
        className="transport-btn primary"
        onClick={() => setIsPlaying((p) => !p)}
        disabled={historyLength === 0}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        className="transport-btn"
        onClick={() => onChange(Math.min(maxIndex, playheadIndex + 1))}
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
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="playback-count">{historyLength ? `${playheadIndex + 1} / ${historyLength}` : '0 / 0'}</span>
    </div>
  )
}
