/**
 * One 8-node graph, solved two ways on this page: harmonically in
 * `HarmonicSolver` and combinatorially in `MincutFigure`. Two dense clusters
 * joined by a single weak bridge — the structure every method on this page is
 * ultimately trying to find.
 */

export interface ToyNode {
  id: number
  x: number
  y: number
  observed: number | null
}

export const TOY_NODES: ToyNode[] = [
  { id: 0, x: 58, y: 105, observed: 0 },
  { id: 1, x: 120, y: 52, observed: null },
  { id: 2, x: 120, y: 158, observed: null },
  { id: 3, x: 182, y: 105, observed: null },
  { id: 4, x: 268, y: 105, observed: null },
  { id: 5, x: 330, y: 52, observed: null },
  { id: 6, x: 330, y: 158, observed: null },
  { id: 7, x: 392, y: 105, observed: 1 },
]

export const TOY_EDGES: [number, number, number][] = [
  [0, 1, 0.9],
  [0, 2, 0.8],
  [1, 2, 0.95],
  [1, 3, 0.85],
  [2, 3, 0.9],
  [3, 4, 0.15], // the bridge — the bottleneck both algorithms key on
  [4, 5, 0.9],
  [4, 6, 0.85],
  [5, 6, 0.95],
  [5, 7, 0.9],
  [6, 7, 0.8],
]

export const BRIDGE: [number, number] = [3, 4]
export const N_TOY = TOY_NODES.length

export function toyAdjacency(): number[][] {
  const W = Array.from({ length: N_TOY }, () => new Array(N_TOY).fill(0))
  TOY_EDGES.forEach(([i, j, w]) => {
    W[i][j] = w
    W[j][i] = w
  })
  return W
}

/** Mirrors `HarmonicPropagator._energy` — the quadratic the solver descends. */
export function energyOf(W: number[][], f: number[][]): number {
  let total = 0
  for (let i = 0; i < N_TOY; i += 1) {
    for (let j = 0; j < N_TOY; j += 1) {
      if (W[i][j] === 0) continue
      let sq = 0
      for (let c = 0; c < f[i].length; c += 1) sq += (f[i][c] - f[j][c]) ** 2
      total += W[i][j] * sq
    }
  }
  return 0.5 * total
}

/** The clamped Jacobi sweep from `harmonic.py`: f ← D⁻¹W f, then reset labels. */
export function harmonicStep(W: number[][], f: number[][], nClasses: number): number[][] {
  const next = f.map((row) => row.slice())

  for (let i = 0; i < N_TOY; i += 1) {
    const degree = W[i].reduce((a, b) => a + b, 0)
    const safe = degree > 0 ? degree : 1
    for (let c = 0; c < nClasses; c += 1) {
      let acc = 0
      for (let j = 0; j < N_TOY; j += 1) acc += W[i][j] * f[j][c]
      next[i][c] = acc / safe
    }
  }

  TOY_NODES.forEach((node) => {
    if (node.observed === null) return
    for (let c = 0; c < nClasses; c += 1) next[node.id][c] = c === node.observed ? 1 : 0
  })

  return next
}

export function harmonicInit(nClasses: number): number[][] {
  return TOY_NODES.map((node) => {
    if (node.observed === null) return new Array(nClasses).fill(1 / nClasses)
    return Array.from({ length: nClasses }, (_, c) => (c === node.observed ? 1 : 0))
  })
}
