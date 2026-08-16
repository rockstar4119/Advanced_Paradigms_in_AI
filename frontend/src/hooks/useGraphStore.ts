import { create } from 'zustand'
import type { NodeOut } from '../types'

interface GraphStoreState {
  sessionId: string | null
  nodes: NodeOut[]
  nClasses: number
  graphReady: boolean
  inspectedNode: number | null
  setDataset: (sessionId: string, nodes: NodeOut[], nClasses: number) => void
  setGraphReady: (ready: boolean) => void
  setInspectedNode: (nodeId: number | null) => void
  toggleNodeLabel: (nodeId: number) => void
}

export const useGraphStore = create<GraphStoreState>((set) => ({
  sessionId: null,
  nodes: [],
  nClasses: 2,
  graphReady: false,
  inspectedNode: null,
  setDataset: (sessionId, nodes, nClasses) =>
    set({ sessionId, nodes, nClasses, graphReady: false, inspectedNode: null }),
  setGraphReady: (ready) => set({ graphReady: ready }),
  setInspectedNode: (nodeId) => set({ inspectedNode: nodeId }),
  toggleNodeLabel: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, observed_label: node.observed_label === null ? node.true_label : null }
          : node,
      ),
    })),
}))
