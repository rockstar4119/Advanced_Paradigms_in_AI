import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '../lib/api'
import { StreamingSocket } from '../lib/streamingSocket'
import type { PropagationRunParams, PropagationStreamEvent } from '../types'

export function usePropagation(sessionId: string | null) {
  const [history, setHistory] = useState<PropagationStreamEvent[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [lastParams, setLastParams] = useState<PropagationRunParams | null>(null)
  const socketRef = useRef<StreamingSocket<PropagationStreamEvent> | null>(null)

  useEffect(() => {
    setHistory([])
    setIsRunning(false)
    setLastParams(null)
    socketRef.current?.close()
  }, [sessionId])

  const run = useCallback(
    (params: PropagationRunParams) => {
      if (!sessionId) return
      setHistory([])
      setIsRunning(true)
      setLastParams(params)
      const socket = new StreamingSocket<PropagationStreamEvent>()
      socketRef.current = socket
      socket.connect(
        apiClient.propagateSocketUrl(sessionId),
        (event) => {
          setHistory((prev) => [...prev, event])
          if (event.type === 'done') setIsRunning(false)
        },
        () => setIsRunning(false),
      )
      socket.send(params)
    },
    [sessionId],
  )

  return { history, isRunning, lastParams, run }
}
