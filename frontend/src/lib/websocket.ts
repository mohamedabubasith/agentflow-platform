import type { AgentEvent, MCPOverrideEntry, WSConnectionState } from './types'

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000'
const HEARTBEAT_MS = 25_000
const MAX_RETRIES = 3

interface SendPayload {
  message: string
  mcp_override?: Record<string, { url: string; transport: string }>
}

type EventCallback = (event: AgentEvent) => void
type StateCallback = (state: WSConnectionState) => void

export class WebSocketClient {
  private ws: WebSocket | null = null
  private agentId = ''
  private conversationId = ''
  private eventCallbacks: EventCallback[] = []
  private stateCallbacks: StateCallback[] = []
  private retryCount = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private messageQueue: SendPayload[] = []
  private state: WSConnectionState = 'disconnected'

  connect(agentId: string, conversationId: string): Promise<void> {
    this.agentId = agentId
    this.conversationId = conversationId
    return this._connect()
  }

  private _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._setState('connecting')
      const url = `${WS_BASE}/api/v1/ws/${this.agentId}/${this.conversationId}`
      try {
        this.ws = new WebSocket(url)
      } catch (e) {
        this._setState('error')
        reject(e)
        return
      }

      this.ws.onopen = () => {
        this.retryCount = 0
        this._setState('connected')
        this._startHeartbeat()
        // Flush queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift()!
          this._sendRaw(msg)
        }
        resolve()
      }

      this.ws.onmessage = (ev) => {
        try {
          const event: AgentEvent = JSON.parse(ev.data as string)
          if (event.type === 'ping') return
          this.eventCallbacks.forEach((cb) => cb(event))
        } catch {}
      }

      this.ws.onerror = () => {
        this._setState('error')
      }

      this.ws.onclose = () => {
        this._stopHeartbeat()
        if (this.state !== 'disconnected') {
          this._attemptReconnect()
        }
      }
    })
  }

  private _attemptReconnect() {
    if (this.retryCount >= MAX_RETRIES) {
      this._setState('error')
      return
    }
    const delay = Math.pow(2, this.retryCount) * 1000
    this.retryCount++
    this._setState('connecting')
    setTimeout(() => {
      this._connect().catch(() => {})
    }, delay)
  }

  send(message: string, mcpOverride?: MCPOverrideEntry[]): void {
    const payload: SendPayload = { message }
    if (mcpOverride && mcpOverride.length > 0) {
      payload.mcp_override = Object.fromEntries(
        mcpOverride.map((e) => [e.name, { url: e.url, transport: e.transport }]),
      )
    }
    if (this.state === 'connected') {
      this._sendRaw(payload)
    } else {
      this.messageQueue.push(payload)
    }
  }

  private _sendRaw(payload: SendPayload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  onEvent(callback: EventCallback): () => void {
    this.eventCallbacks.push(callback)
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback)
    }
  }

  onStateChange(callback: StateCallback): () => void {
    this.stateCallbacks.push(callback)
    return () => {
      this.stateCallbacks = this.stateCallbacks.filter((cb) => cb !== callback)
    }
  }

  disconnect(): void {
    this._setState('disconnected')
    this._stopHeartbeat()
    this.messageQueue = []
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
  }

  getState(): WSConnectionState {
    return this.state
  }

  private _setState(state: WSConnectionState) {
    this.state = state
    this.stateCallbacks.forEach((cb) => cb(state))
  }

  private _startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Backend pings us; we just keep the connection alive via send
      }
    }, HEARTBEAT_MS)
  }

  private _stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}
