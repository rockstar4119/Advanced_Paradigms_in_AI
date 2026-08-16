import type { CSSProperties } from 'react'

export function rangeProgress(value: number, min: number, max: number): CSSProperties {
  const pct = ((value - min) / (max - min)) * 100
  return { '--pct': `${pct}%` } as unknown as CSSProperties
}
