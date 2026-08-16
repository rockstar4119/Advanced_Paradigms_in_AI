import cytoscape from 'cytoscape'
import { UNLABELED_COLOR } from './colors'

// Nodes are deliberately small. At 14px they tiled over each other on a
// 200-node k-NN graph and the edges — the thing the whole studio is about —
// survived only as slivers between discs. Shrinking the marks hands that space
// back to the structure; brightness, not area, is what makes a node readable.
export const NODE_SIZE = 9
export const INSPECTED_NODE_SIZE = 13

const EDGE_MIN_WIDTH = 0.5
const EDGE_MAX_WIDTH = 1.9
const EDGE_MIN_OPACITY = 0.3
const EDGE_MAX_OPACITY = 0.9

/**
 * Affinity is carried mostly by opacity rather than stroke width: thick strokes
 * next to 9px nodes re-create the same mat of ink the small nodes were meant to
 * clear, while a weak edge that simply fades out costs no space at all.
 */
export function edgeVisual(weight: number): { width: number; strength: number } {
  const clamped = Math.max(0, Math.min(1, weight))
  return {
    width: EDGE_MIN_WIDTH + clamped * (EDGE_MAX_WIDTH - EDGE_MIN_WIDTH),
    strength: EDGE_MIN_OPACITY + clamped * (EDGE_MAX_OPACITY - EDGE_MIN_OPACITY),
  }
}

export const cytoscapeStyles: cytoscape.StylesheetStyle[] = [
  {
    selector: 'node',
    style: {
      'background-color': UNLABELED_COLOR,
      width: NODE_SIZE,
      height: NODE_SIZE,
      'border-width': 1,
      'border-color': 'rgba(12, 16, 24, 0.85)',
      'z-index': 10,
    },
  },
  {
    selector: 'node[?labeled]',
    style: {
      'underlay-color': 'data(glowColor)',
      'underlay-opacity': 0.45,
      'underlay-padding': 5,
      'underlay-shape': 'ellipse',
      'border-color': 'rgba(255, 255, 255, 0.75)',
      'z-index': 20,
    },
  },
  {
    // Edges carry their own opacity so weak affinities recede and strong ones
    // read as structure, instead of every edge averaging into one grey haze.
    // A mapper function rather than 'data(strength)' because the typings admit
    // only numbers here — the value is a number either way.
    selector: 'edge',
    style: {
      width: 'data(width)',
      'line-color': '#aebdd6',
      'line-opacity': (edge: cytoscape.EdgeSingular) => Number(edge.data('strength') ?? EDGE_MAX_OPACITY),
      'curve-style': 'straight',
      'z-index': 1,
    },
  },
  {
    // The flow path has to win against every other edge on the canvas, so it
    // gets full opacity, the widest stroke, and the top of the edge stack.
    selector: 'edge.augmenting',
    style: {
      'line-color': '#f0803f',
      width: 3,
      'line-opacity': 1,
      'z-index': 6,
    },
  },
  {
    selector: 'node.on-path',
    style: {
      'border-width': 2,
      'border-color': '#f0803f',
      'border-opacity': 1,
      'underlay-color': '#f0803f',
      'underlay-opacity': 0.35,
      'underlay-padding': 4,
      'underlay-shape': 'ellipse',
      'z-index': 40,
    },
  },
  {
    selector: 'edge.cut',
    style: {
      'line-color': '#e66767',
      width: 2.6,
      'line-style': 'dashed',
      'line-opacity': 1,
      'z-index': 5,
    },
  },
  {
    selector: 'node.inspected',
    style: {
      width: INSPECTED_NODE_SIZE,
      height: INSPECTED_NODE_SIZE,
      'border-width': 2,
      'border-color': '#9085e9',
      'border-opacity': 1,
      'z-index': 99,
    },
  },
]
