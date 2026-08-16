import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiClient } from '../lib/api'
import { StreamingSocket } from '../lib/streamingSocket'
import type { BuildDoneEvent, EdgeAddedEvent, GraphBuildParams, GraphStreamEvent } from '../types'

export interface GraphStats {
  density: number
  avgDegree: number
  nComponents: number
  algebraicConnectivity: number
  meanEdgeWeight: number
}

/**
 * The socket delivers the whole edge list in a fraction of a second, which used
 * to mean the graph simply blinked into existence. Edges are buffered on
 * arrival and revealed on this clock instead, so the k-NN neighbourhood
 * structure visibly assembles itself.
 *
 * The reveal is paced by *duration*, not by a fixed edges-per-second: a k-NN
 * graph has a few hundred edges but a fully-connected RBF graph on 500 nodes
 * has ~125k, and any fixed rate that suits one is absurd for the other.
 */
const TARGET_BUILD_MS = 6500
const TICK_MS = 1000 / 30

function toStats(event: BuildDoneEvent): GraphStats {
  return {
    density: event.density,
    avgDegree: event.avg_degree,
    nComponents: event.n_components,
    algebraicConnectivity: event.algebraic_connectivity,
    meanEdgeWeight: event.mean_edge_weight,
  }
}

export function useGraphBuild(sessionId: string | null) {
  const bufferRef = useRef<EdgeAddedEvent[]>([])
  const socketRef = useRef<StreamingSocket<GraphStreamEvent> | null>(null)

  const [revealed, setRevealed] = useState(0)
  const [isBuilding, setIsBuilding] = useState(false)
  const [finalEvent, setFinalEvent] = useState<BuildDoneEvent | null>(null)
  const [streamClosed, setStreamClosed] = useState(false)
  const [settled, setSettled] = useState(false)

  const reset = useCallback(() => {
    bufferRef.current = []
    setRevealed(0)
    setIsBuilding(false)
    setFinalEvent(null)
    setStreamClosed(false)
    setSettled(false)
  }, [])

  useEffect(() => {
    reset()
    socketRef.current?.close()
  }, [sessionId, reset])

  useEffect(() => () => socketRef.current?.close(), [])

  // Reveal pump: runs while edges are still arriving or still queued. Progress
  // is read off the wall clock rather than accumulated per tick, so interval
  // drift can't stretch a 6.5s reveal into a 15s one.
  useEffect(() => {
    if (!isBuilding || settled) return
    const startedAt = performance.now()
    const timer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / TARGET_BUILD_MS)
      const target = Math.ceil(bufferRef.current.length * progress)
      setRevealed((prev) => Math.max(prev, Math.min(target, bufferRef.current.length)))
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [isBuilding, settled])

  // The build is finished only once the stream has closed *and* the last
  // buffered edge has actually been drawn — otherwise propagation could start
  // against a graph the user is still watching appear.
  useEffect(() => {
    if (!isBuilding || settled || !streamClosed) return
    if (finalEvent === null) {
      setIsBuilding(false) // closed without build_done — the build failed
      return
    }
    if (revealed < bufferRef.current.length) return
    setSettled(true)
    setIsBuilding(false)
  }, [isBuilding, settled, streamClosed, finalEvent, revealed])

  const build = useCallback(
    (params: GraphBuildParams) => {
      if (!sessionId) return
      reset()
      setIsBuilding(true)

      const socket = new StreamingSocket<GraphStreamEvent>()
      socketRef.current = socket
      socket.connect(
        apiClient.graphSocketUrl(sessionId),
        (event) => {
          if (event.type === 'edge_added') bufferRef.current.push(event)
          else if (event.type === 'build_done') setFinalEvent(event)
        },
        () => setStreamClosed(true),
      )
      socket.send(params)
    },
    [sessionId, reset],
  )

  const edges = useMemo(() => bufferRef.current.slice(0, revealed), [revealed])

  return {
    edges,
    isBuilding,
    edgeCount: settled && finalEvent ? finalEvent.edge_count : null,
    stats: settled && finalEvent ? toStats(finalEvent) : null,
    build,
  }
}
