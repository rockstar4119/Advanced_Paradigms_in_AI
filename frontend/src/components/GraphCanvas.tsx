import { useEffect, useRef } from 'react'
import { CytoscapeGraphController } from '../lib/graphController'
import { useGraphStore } from '../hooks/useGraphStore'
import { Legend } from './Legend'
import type { EdgeAddedEvent, PropagationStreamEvent } from '../types'

interface GraphCanvasProps {
  edges: EdgeAddedEvent[]
  history: PropagationStreamEvent[]
  playheadIndex: number
}

function FitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

export function GraphCanvas({ edges, history, playheadIndex }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<CytoscapeGraphController | null>(null)
  const renderedEdgeCount = useRef(0)

  const sessionId = useGraphStore((state) => state.sessionId)
  const nodes = useGraphStore((state) => state.nodes)
  const toggleNodeLabel = useGraphStore((state) => state.toggleNodeLabel)
  const inspectedNode = useGraphStore((state) => state.inspectedNode)
  const setInspectedNode = useGraphStore((state) => state.setInspectedNode)

  useEffect(() => {
    if (!containerRef.current) return
    controllerRef.current = new CytoscapeGraphController(containerRef.current)
    return () => controllerRef.current?.destroy()
  }, [])

  useEffect(() => {
    controllerRef.current?.setInspectHandler(setInspectedNode)
  }, [setInspectedNode])

  useEffect(() => {
    controllerRef.current?.highlightNode(inspectedNode)
  }, [inspectedNode, nodes])

  useEffect(() => {
    if (!sessionId) return
    controllerRef.current?.loadNodes(nodes, toggleNodeLabel)
    renderedEdgeCount.current = 0
  }, [sessionId])

  useEffect(() => {
    controllerRef.current?.applyObservedLabels(nodes)
  }, [nodes])

  useEffect(() => {
    const controller = controllerRef.current
    if (!controller) return
    if (edges.length === 0) {
      controller.clearEdges()
      renderedEdgeCount.current = 0
      return
    }
    controller.addEdges(edges.slice(renderedEdgeCount.current))
    renderedEdgeCount.current = edges.length
  }, [edges])

  useEffect(() => {
    const controller = controllerRef.current
    if (!controller) return
    // Rewind to a clean slate, then replay up to the playhead. This is what
    // makes scrubbing backwards actually undo work rather than just stop it.
    controller.applyObservedLabels(nodes)
    controller.clearTransientState()
    for (let i = 0; i <= playheadIndex && i < history.length; i++) {
      const event = history[i]
      if (event.type === 'iteration') {
        controller.setSoftLabels(event.soft_labels)
      } else if (event.type === 'augment_path') {
        controller.highlightPath(event.path)
      } else if (event.type === 'mincut_found') {
        controller.applyCutEdges(event.cut_edges)
      } else if (event.type === 'done') {
        controller.applyFinalLabels(event.labels)
      }
    }
  }, [history, playheadIndex, nodes])

  return (
    <div className="canvas-frame">
      <div ref={containerRef} className="graph-canvas" />
      {nodes.length > 0 && (
        <div className="canvas-badge">
          <span>{nodes.length} nodes</span>
          <span className="dot-sep" />
          <span>{edges.length} edges</span>
          <span className="dot-sep" />
          <span className="canvas-hint">click to inspect · shift-click to label</span>
        </div>
      )}
      <Legend inline />
      <button className="fit-button" onClick={() => controllerRef.current?.fit()} aria-label="Fit graph to view">
        <FitIcon />
      </button>
    </div>
  )
}
