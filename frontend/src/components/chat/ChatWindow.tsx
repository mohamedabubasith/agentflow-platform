'use client'

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { AlertCircle, Wifi, WifiOff, Settings2, ArrowDown, Activity } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { WebSocketClient } from '@/lib/websocket'
import type { AgentEvent, ConversationMessage, WSEventDone } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageBubble } from './MessageBubble'
import { StreamingIndicator } from './StreamingIndicator'
import { MCPOverride } from './MCPOverride'

interface ChatWindowProps {
  agentId: string
  conversationId: string
  agentName: string
  llmModel: string
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const MAX_CHARS = 4000

function latencyColor(ms: number): string {
  if (ms === 0) return 'text-[#3f3f46]'
  if (ms < 80) return 'text-[#22c55e]'
  if (ms < 250) return 'text-yellow-400'
  return 'text-[#ef4444]'
}

export function ChatWindow({
  agentId,
  conversationId,
  agentName,
  llmModel,
}: ChatWindowProps) {
  const messages = useChatStore((s) => s.messages)
  const wsState = useChatStore((s) => s.wsState)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingAgentName = useChatStore((s) => s.streamingAgentName)
  const currentStreamingId = useChatStore((s) => s.currentStreamingId)
  const mcpOverrides = useChatStore((s) => s.mcpOverrides)

  const addMessage = useChatStore((s) => s.addMessage)
  const appendToken = useChatStore((s) => s.appendToken)
  const finalizeMessage = useChatStore((s) => s.finalizeMessage)
  const addEvent = useChatStore((s) => s.addEvent)
  const setWsState = useChatStore((s) => s.setWsState)
  const setIsStreaming = useChatStore((s) => s.setIsStreaming)
  const setStreamingAgentName = useChatStore((s) => s.setStreamingAgentName)
  const setCurrentStreamingId = useChatStore((s) => s.setCurrentStreamingId)
  const clearMessages = useChatStore((s) => s.clearMessages)
  const clearEvents = useChatStore((s) => s.clearEvents)

  const [input, setInput] = useState('')
  const [showMcpPanel, setShowMcpPanel] = useState(false)
  const [latencyMs, setLatencyMs] = useState(0)
  const [lastTokenUsage, setLastTokenUsage] = useState<WSEventDone['tokens_used'] | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [serverRestarting, setServerRestarting] = useState(false)

  const wsRef = useRef<WebSocketClient | null>(null)
  const wsCleanupRef = useRef<(() => void) | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamingIdRef = useRef<string | null>(null)

  useEffect(() => {
    streamingIdRef.current = currentStreamingId
  }, [currentStreamingId])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  // Track scroll position to show/hide scroll-to-bottom button
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setIsAtBottom(distFromBottom < 60)
  }, [])

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        case 'token': {
          const sid = streamingIdRef.current
          if (sid) {
            appendToken(sid, event.content)
          } else {
            const newId = generateId()
            streamingIdRef.current = newId
            setCurrentStreamingId(newId)
            addMessage({
              id: newId,
              role: 'assistant',
              content: event.content,
              timestamp: new Date().toISOString(),
              isStreaming: true,
            })
          }
          break
        }

        case 'done': {
          const sid = streamingIdRef.current
          if (sid) {
            finalizeMessage(sid, event.full_response)
            streamingIdRef.current = null
            setCurrentStreamingId(null)
          }
          setIsStreaming(false)
          setLastTokenUsage(event.tokens_used)
          break
        }

        case 'agent_start': {
          setIsStreaming(true)
          setStreamingAgentName(event.agent_name)
          addEvent(event)
          break
        }

        case 'error': {
          addEvent(event)
          setIsStreaming(false)
          streamingIdRef.current = null
          setCurrentStreamingId(null)
          break
        }

        case 'server_restart': {
          setServerRestarting(true)
          addEvent(event)
          break
        }

        case 'ping':
        case 'connected':
          break

        default: {
          addEvent(event)
          break
        }
      }
    },
    [
      addMessage,
      appendToken,
      finalizeMessage,
      addEvent,
      setIsStreaming,
      setStreamingAgentName,
      setCurrentStreamingId,
    ],
  )

  useEffect(() => {
    const client = new WebSocketClient()
    wsRef.current = client

    const unsubEvent = client.onEvent(handleEvent)
    const unsubState = client.onStateChange((state) => {
      setWsState(state)
      if (state === 'connected') setServerRestarting(false)
    })
    const unsubLatency = client.onLatencyChange(setLatencyMs)

    wsCleanupRef.current = () => {
      unsubEvent()
      unsubState()
      unsubLatency()
      client.disconnect()
    }

    client.connect(agentId, conversationId).catch(() => {})

    return () => {
      wsCleanupRef.current?.()
      wsRef.current = null
      wsCleanupRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, conversationId])

  // Auto-scroll to bottom when new messages arrive, if already at bottom
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom()
    }
  }, [messages.length, isAtBottom, scrollToBottom])

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    if (val.length > MAX_CHARS) return
    setInput(val)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isStreaming) return

    addMessage({
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    })

    wsRef.current?.send(text, mcpOverrides.length > 0 ? mcpOverrides : undefined)
    setInput('')
    setLastTokenUsage(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    scrollToBottom()
  }, [input, isStreaming, addMessage, mcpOverrides, scrollToBottom])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleReconnect = () => {
    wsCleanupRef.current?.()
    wsCleanupRef.current = null
    wsRef.current = null

    const client = new WebSocketClient()
    wsRef.current = client

    const unsubEvent = client.onEvent(handleEvent)
    const unsubState = client.onStateChange((state) => {
      setWsState(state)
      if (state === 'connected') setServerRestarting(false)
    })
    const unsubLatency = client.onLatencyChange(setLatencyMs)

    wsCleanupRef.current = () => {
      unsubEvent()
      unsubState()
      unsubLatency()
      client.disconnect()
    }

    client.connect(agentId, conversationId).catch(() => {})
  }

  const handleClear = () => {
    clearMessages()
    clearEvents()
    setLastTokenUsage(null)
  }

  const canSend = input.trim().length > 0 && !isStreaming

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-semibold text-[#f4f4f5] truncate">{agentName}</h2>
          <Badge variant="muted" className="font-mono shrink-0">
            {llmModel}
          </Badge>
          {/* WS status dot */}
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full shrink-0',
              wsState === 'connected' && 'bg-[#22c55e]',
              wsState === 'connecting' && 'bg-yellow-400 animate-pulse',
              wsState === 'error' && 'bg-[#ef4444]',
              wsState === 'disconnected' && 'bg-[#3f3f46]',
            )}
            title={wsState}
          />
          {/* Latency indicator */}
          {wsState === 'connected' && latencyMs > 0 && (
            <span
              className={cn('text-[10px] font-mono tabular-nums flex items-center gap-0.5', latencyColor(latencyMs))}
              title="WebSocket latency"
            >
              <Activity className="h-2.5 w-2.5" />
              {latencyMs}ms
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMcpPanel((v) => !v)}
          className={cn(
            'h-8 px-2 gap-1.5 text-[#71717a] hover:text-[#f4f4f5]',
            showMcpPanel && 'bg-[#111111] text-[#f4f4f5]',
          )}
          aria-label="Toggle MCP overrides"
        >
          <Settings2 className="h-4 w-4" />
          <span className="text-xs">MCP</span>
        </Button>
      </div>

      {showMcpPanel && <MCPOverride />}

      {/* Server restart notice */}
      {serverRestarting && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <Wifi className="h-4 w-4 text-yellow-400 shrink-0 animate-pulse" />
          <p className="text-xs text-yellow-400 flex-1">
            Server is restarting — reconnecting…
          </p>
        </div>
      )}

      {wsState === 'error' && !serverRestarting && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[#ef4444]/10 border-b border-[#ef4444]/20">
          <WifiOff className="h-4 w-4 text-[#ef4444] shrink-0" />
          <p className="text-xs text-[#ef4444] flex-1">
            Connection lost — messages may not be delivered.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReconnect}
            className="h-7 px-2 text-xs text-[#ef4444] hover:text-white hover:bg-[#ef4444]/20"
          >
            Reconnect
          </Button>
        </div>
      )}
      {wsState === 'connecting' && !serverRestarting && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <Wifi className="h-4 w-4 text-yellow-400 shrink-0 animate-pulse" />
          <p className="text-xs text-yellow-400">Connecting to agent...</p>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full px-8">
            <div className="text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-[#3f3f46] mx-auto" />
              <p className="text-sm text-[#71717a]">Send a message to start the conversation</p>
              <p className="text-xs text-[#3f3f46]">
                Talking to <span className="text-[#71717a]">{agentName}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && (
              <StreamingIndicator agentName={streamingAgentName || agentName} eventType={null} />
            )}
            {/* Token usage after the last run */}
            {!isStreaming && lastTokenUsage && (
              <div className="flex justify-end">
                <span className="text-[10px] font-mono text-[#3f3f46] bg-[#111111] border border-[#1f1f1f] rounded px-2 py-0.5">
                  {lastTokenUsage.prompt}↑ {lastTokenUsage.completion}↓ {lastTokenUsage.total} tokens
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll-to-bottom FAB */}
        {!isAtBottom && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-4 right-4 h-8 w-8 rounded-full bg-[#1f1f1f] border border-[#2f2f2f] flex items-center justify-center text-[#71717a] hover:text-[#f4f4f5] transition-colors shadow-lg"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-[#1f1f1f] bg-[#0a0a0a] px-4 pt-3 pb-4">
        <div className="relative rounded-xl border border-[#1f1f1f] bg-[#111111] focus-within:border-[#6366f1]/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agentName}...`}
            rows={1}
            className={cn(
              'w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-[#f4f4f5]',
              'placeholder:text-[#71717a] focus:outline-none',
              'min-h-[44px] max-h-[200px] overflow-y-auto',
            )}
            style={{ height: 'auto' }}
            disabled={wsState === 'error' || wsState === 'disconnected'}
          />
          <div className="flex items-center justify-between px-3 pb-2 pt-0">
            <span
              className={cn(
                'text-[10px] font-mono',
                input.length > MAX_CHARS * 0.9 ? 'text-[#ef4444]' : 'text-[#3f3f46]',
              )}
            >
              {input.length > 0 ? `${input.length} / ${MAX_CHARS}` : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 px-2 text-xs text-[#71717a] hover:text-[#f4f4f5]"
                disabled={messages.length === 0}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!canSend || wsState === 'error' || wsState === 'disconnected'}
                className="h-7 px-3 text-xs"
              >
                Send
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-[#3f3f46] text-center">
          Enter to send &nbsp;·&nbsp; Shift+Enter for newline
        </p>
      </div>
    </div>
  )
}
