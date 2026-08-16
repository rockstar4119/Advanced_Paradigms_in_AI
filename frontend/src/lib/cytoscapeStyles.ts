import cytoscape from 'cytoscape'
import { UNLABELED_COLOR } from './colors'

export const cytoscapeStyles: cytoscape.StylesheetStyle[] = [
  {
    selector: 'node',
    style: {
      'background-color': UNLABELED_COLOR,
      width: 14,
      height: 14,
      'border-width': 2,
      'border-color': 'rgba(255, 255, 255, 0.18)',
    },
  },
  {
    selector: 'node[?labeled]',
    style: {
      'underlay-color': 'data(glowColor)',
      'underlay-opacity': 0.55,
      'underlay-padding': 7,
      'underlay-shape': 'ellipse',
      'border-color': 'rgba(255, 255, 255, 0.55)',
    },
  },
  {
    selector: 'edge',
    style: {
      width: 'data(width)',
      'line-color': 'rgba(255, 255, 255, 0.22)',
      opacity: 0.6,
      'curve-style': 'straight',
    },
  },
  {
    selector: 'edge.augmenting',
    style: {
      'line-color': '#d95926',
      width: 4,
      opacity: 1,
    },
  },
  {
    selector: 'edge.cut',
    style: {
      'line-color': '#e66767',
      width: 3,
      'line-style': 'dashed',
      opacity: 1,
    },
  },
  {
    selector: 'node.inspected',
    style: {
      'border-width': 3,
      'border-color': '#9085e9',
      'border-opacity': 1,
      'z-index': 99,
    },
  },
]
