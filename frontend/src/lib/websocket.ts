import type { AgentEvent, MCPOverrideEntry, WSConnectionState } from './types'

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000'
const HEARTBEAT_MS = 25_000
const MAX_RETRIES = 3
const PING_INTERVAL_MS = 10_000

interface SendPayload {
  message: string
  mcp_override?: Record<string, { url: string; transport: string }>
}

type EventCallback = (event: AgentEvent) => void
type StateCallback = (state: WSConnectionState) => void
type LatencyCallback = (latencyMs: number) => void

export class WebSocketClient {
  private ws: WebSocket | null = null
  private agentId = ''
  private conversationId = ''
  private eventCallbacks: EventCallback[] = []
  private stateCallbacks: StateCallback[] = []
  private latencyCallbacks: LatencyCallback[] = []
  private retryCount = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pingPendingSince: number | null = null
  private messageQueue: SendPayload[] = []
  private state: WSConnectionState = 'disconnected'
  private latencyMs = 0

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
        this._startPingProbe()
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift()!
          this._sendRaw(msg)
        }
        resolve()
      }

      this.ws.onmessage = (ev) => {
        try {
          const event: AgentEvent = JSON.parse(ev.data as string)

          if (event.type === 'ping') {
            // Server heartbeat ping — measure roundtrip if we sent our own ping
            if (this.pingPendingSince !== null) {
              this.latencyMs = Math.round(performance.now() - this.pingPendingSince)
              this.pingPendingSince = null
              this.latencyCallbacks.forEach((cb) => cb(this.latencyMs))
            }
            return
          }

          if (event.type === 'server_restart') {
            // Server is going down — set error state and let auto-reconnect run
            this._setState('error')
            this.eventCallbacks.forEach((cb) => cb(event))
            return
          }

          this.eventCallbacks.forEach((cb) => cb(event))
        } catch {}
      }

      this.ws.onerror = () => {
        this._setState('error')
      }

      this.ws.onclose = () => {
        this._stopHeartbeat()
        this._stopPingProbe()
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

  onLatencyChange(callback: LatencyCallback): () => void {
    this.latencyCallbacks.push(callback)
    return () => {
      this.latencyCallbacks = this.latencyCallbacks.filter((cb) => cb !== callback)
    }
  }

  disconnect(): void {
    this._setState('disconnected')
    this._stopHeartbeat()
    this._stopPingProbe()
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

  getLatencyMs(): number {
    return this.latencyMs
  }

  private _setState(state: WSConnectionState) {
    this.state = state
    this.stateCallbacks.forEach((cb) => cb(state))
  }

  private _startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      // Keep-alive: server sends pings; we just need to not close the socket
    }, HEARTBEAT_MS)
  }

  private _stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private _startPingProbe() {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN && this.pingPendingSince === null) {
        this.pingPendingSince = performance.now()
        // We can't send a bare "ping" WebSocket frame from the browser;
        // instead we send a JSON ping that the server echoes back.
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, PING_INTERVAL_MS)
  }

  private _stopPingProbe() {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
      this.pingPendingSince = null
    }
  }
}
