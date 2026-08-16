import { useCallback, useEffect, useRef, useState } from 'react'
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

interface GraphBuildState {
  edges: EdgeAddedEvent[]
  isBuilding: boolean
  edgeCount: number | null
  stats: GraphStats | null
}

const INITIAL_STATE: GraphBuildState = { edges: [], isBuilding: false, edgeCount: null, stats: null }

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
  const [state, setState] = useState<GraphBuildState>(INITIAL_STATE)
  const socketRef = useRef<StreamingSocket<GraphStreamEvent> | null>(null)

  useEffect(() => {
    setState(INITIAL_STATE)
    socketRef.current?.close()
  }, [sessionId])

  const build = useCallback(
    (params: GraphBuildParams) => {
      if (!sessionId) return
      setState({ edges: [], isBuilding: true, edgeCount: null, stats: null })
      const socket = new StreamingSocket<GraphStreamEvent>()
      socketRef.current = socket
      socket.connect(
        apiClient.graphSocketUrl(sessionId),
        (event) => {
          if (event.type === 'edge_added') {
            setState((prev) => ({ ...prev, edges: [...prev.edges, event] }))
          } else if (event.type === 'build_done') {
            setState((prev) => ({ ...prev, isBuilding: false, edgeCount: event.edge_count, stats: toStats(event) }))
          }
        },
        () => setState((prev) => ({ ...prev, isBuilding: false })),
      )
      socket.send(params)
    },
    [sessionId],
  )

  return { ...state, build }
}
