// Categorical hues from the validated dark palette (blue, orange, aqua, red) —
// order is the CVD-safety mechanism, never reassign or cycle it.
export const CLASS_COLORS = ['#3987e5', '#d95926', '#199e70', '#e66767']
export const UNLABELED_COLOR = '#5B6472'
export const ACCENT_COLOR = '#9085e9'

export function classColor(classIndex: number): string {
  return CLASS_COLORS[classIndex % CLASS_COLORS.length]
}

export function blendColor(softLabel: number[]): string {
  let r = 0
  let g = 0
  let b = 0
  softLabel.forEach((weight, i) => {
    const [cr, cg, cb] = hexToRgb(classColor(i))
    r += cr * weight
    g += cg * weight
    b += cb * weight
  })
  return rgbToHex(r, g, b)
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`
}
