export class StreamingSocket<TIncoming> {
  private socket: WebSocket | null = null

  connect(url: string, onMessage: (event: TIncoming) => void, onClose?: () => void): void {
    const socket = new WebSocket(url)
    socket.onmessage = (message) => {
      onMessage(JSON.parse(message.data) as TIncoming)
    }
    socket.onclose = () => onClose?.()
    this.socket = socket
  }

  send(payload: unknown): void {
    const socket = this.socket
    if (!socket) return
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload))
    } else {
      socket.addEventListener('open', () => socket.send(JSON.stringify(payload)), { once: true })
    }
  }

  close(): void {
    this.socket?.close()
    this.socket = null
  }
}
