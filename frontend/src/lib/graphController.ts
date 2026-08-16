import cytoscape, { Core } from 'cytoscape'
import { cytoscapeStyles, edgeVisual } from './cytoscapeStyles'
import { blendColor, classColor, UNLABELED_COLOR } from './colors'
import type { NodeOut } from '../types'

const COORD_SCALE = 90

export class CytoscapeGraphController {
  private cy: Core
  private onNodeClick: ((nodeId: number) => void) | null = null
  private onNodeInspect: ((nodeId: number) => void) | null = null

  constructor(container: HTMLElement) {
    this.cy = cytoscape({
      container,
      style: cytoscapeStyles,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    })
    // Plain tap inspects — reading a node must never mutate it. Shift+tap is
    // the deliberate gesture that reveals or hides its label.
    this.cy.on('tap', 'node', (evt) => {
      const nodeId = Number(evt.target.id())
      const shift = Boolean((evt.originalEvent as MouseEvent | undefined)?.shiftKey)
      if (shift) this.onNodeClick?.(nodeId)
      else this.onNodeInspect?.(nodeId)
    })
  }

  setInspectHandler(handler: (nodeId: number) => void): void {
    this.onNodeInspect = handler
  }

  highlightNode(nodeId: number | null): void {
    this.cy.nodes().removeClass('inspected')
    if (nodeId !== null) this.cy.getElementById(String(nodeId)).addClass('inspected')
  }

  loadNodes(nodes: NodeOut[], onNodeClick: (nodeId: number) => void): void {
    this.onNodeClick = onNodeClick
    this.cy.elements().remove()
    const elements = nodes.map((node) => ({
      data: { id: String(node.id) },
      position: { x: node.x * COORD_SCALE, y: node.y * COORD_SCALE },
    }))
    this.cy.add(elements)
    this.applyObservedLabels(nodes)
    this.cy.fit(undefined, 40)
  }

  applyObservedLabels(nodes: NodeOut[]): void {
    nodes.forEach((node) => {
      const cyNode = this.cy.getElementById(String(node.id))
      if (cyNode.empty()) return
      if (node.observed_label !== null) {
        const color = classColor(node.observed_label)
        cyNode.style('background-color', color)
        cyNode.data('labeled', true)
        cyNode.data('glowColor', color)
      } else {
        cyNode.style('background-color', UNLABELED_COLOR)
        cyNode.data('labeled', false)
        cyNode.data('glowColor', undefined)
      }
    })
  }

  /**
   * Add a slice of edges in one go. One `cy.add()` per edge forced a style
   * recalculation and a redraw per edge, which saturated the main thread and
   * stretched a 6.5s reveal past eleven seconds; a single batched add per
   * animation frame keeps the build on its clock.
   */
  addEdges(edges: { source: number; target: number; weight: number }[]): void {
    const additions = edges
      .map(({ source, target, weight }) => ({
        data: { id: `e${source}-${target}`, source: String(source), target: String(target), ...edgeVisual(weight) },
      }))
      .filter((element) => this.cy.getElementById(element.data.id).empty())

    if (additions.length === 0) return
    this.cy.batch(() => this.cy.add(additions))
  }

  clearEdges(): void {
    this.cy.edges().remove()
  }

  setSoftLabels(softLabels: number[][]): void {
    softLabels.forEach((weights, nodeId) => {
      const cyNode = this.cy.getElementById(String(nodeId))
      if (cyNode.empty() || cyNode.data('labeled')) return
      cyNode.style('background-color', blendColor(weights))
    })
  }

  /**
   * Drop every mark a propagation step can leave behind. The canvas replays
   * history from index 0 on each playhead move, so without this the augmenting
   * and cut classes only ever accumulated: scrubbing backwards past a min-cut
   * left the cut edges drawn over a graph that had not been cut yet.
   */
  clearTransientState(): void {
    this.cy.edges().removeClass('augmenting cut')
    this.cy.nodes().removeClass('on-path')
  }

  highlightPath(path: number[]): void {
    this.cy.edges().removeClass('augmenting')
    this.cy.nodes().removeClass('on-path')
    for (let i = 0; i < path.length - 1; i++) {
      this.edgeBetween(path[i], path[i + 1]).addClass('augmenting')
    }
    // Light the nodes too — a 2px orange thread through a few hundred edges is
    // hard to follow on its own. The virtual source/sink indices sit past the
    // end of the node list, so they simply match nothing.
    path.forEach((node) => this.cy.getElementById(String(node)).addClass('on-path'))
  }

  applyCutEdges(cutEdges: [number, number][]): void {
    cutEdges.forEach(([u, v]) => {
      this.edgeBetween(u, v).addClass('cut')
    })
  }

  applyFinalLabels(labels: Record<number, number>): void {
    Object.entries(labels).forEach(([nodeId, label]) => {
      const cyNode = this.cy.getElementById(nodeId)
      if (cyNode.empty() || cyNode.data('labeled')) return
      cyNode.style('background-color', classColor(label))
    })
  }

  fit(): void {
    this.cy.fit(undefined, 40)
  }

  destroy(): void {
    this.cy.destroy()
  }

  private edgeBetween(a: number, b: number) {
    return this.cy.edges(`[source = "${a}"][target = "${b}"], [source = "${b}"][target = "${a}"]`)
  }
}
