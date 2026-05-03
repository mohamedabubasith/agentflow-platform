'use client'

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { AlertCircle, Wifi, WifiOff, Settings2 } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { WebSocketClient } from '@/lib/websocket'
import type { AgentEvent, ConversationMessage } from '@/lib/types'
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

export function ChatWindow({
  agentId,
  conversationId,
  agentName,
  llmModel,
}: ChatWindowProps) {
  // Store selectors
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

  // Local UI state
  const [input, setInput] = useState('')
  const [showMcpPanel, setShowMcpPanel] = useState(false)

  // Refs — stable across renders, no effect re-runs
  const wsRef = useRef<WebSocketClient | null>(null)
  const wsCleanupRef = useRef<(() => void) | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Track the streaming message id in a ref so the event handler always has it fresh
  const streamingIdRef = useRef<string | null>(null)

  // Keep streamingIdRef in sync with store
  useEffect(() => {
    streamingIdRef.current = currentStreamingId
  }, [currentStreamingId])

  // Process incoming WS events
  const handleEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        case 'token': {
          const sid = streamingIdRef.current
          if (sid) {
            appendToken(sid, event.content)
          } else {
            // No streaming message yet — create one
            const newId = generateId()
            streamingIdRef.current = newId
            setCurrentStreamingId(newId)
            const msg: ConversationMessage = {
              id: newId,
              role: 'assistant',
              content: event.content,
              timestamp: new Date().toISOString(),
              isStreaming: true,
            }
            addMessage(msg)
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

  // WS lifecycle — runs once on mount, cleans up on unmount
  useEffect(() => {
    const client = new WebSocketClient()
    wsRef.current = client

    const unsubEvent = client.onEvent(handleEvent)
    const unsubState = client.onStateChange(setWsState)

    wsCleanupRef.current = () => {
      unsubEvent()
      unsubState()
      client.disconnect()
    }

    client.connect(agentId, conversationId).catch(() => {
      // Error state is set via onStateChange
    })

    return () => {
      wsCleanupRef.current?.()
      wsRef.current = null
      wsCleanupRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, conversationId])

  // Auto-scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Auto-resize textarea
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    if (val.length > MAX_CHARS) return
    setInput(val)
    // Reset height then grow
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isStreaming) return

    // Add user message to store
    const userMsg: ConversationMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    addMessage(userMsg)

    // Send via WS
    wsRef.current?.send(text, mcpOverrides.length > 0 ? mcpOverrides : undefined)

    // Clear input
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, isStreaming, addMessage, mcpOverrides])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleReconnect = () => {
    // Tear down existing connection cleanly
    wsCleanupRef.current?.()
    wsCleanupRef.current = null
    wsRef.current = null

    // Create a fresh client
    const client = new WebSocketClient()
    wsRef.current = client

    const unsubEvent = client.onEvent(handleEvent)
    const unsubState = client.onStateChange(setWsState)

    wsCleanupRef.current = () => {
      unsubEvent()
      unsubState()
      client.disconnect()
    }

    client.connect(agentId, conversationId).catch(() => {})
  }

  const handleClear = () => {
    clearMessages()
    clearEvents()
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

      {/* MCP Override panel — collapses/expands */}
      {showMcpPanel && <MCPOverride />}

      {/* Connection status banners */}
      {wsState === 'error' && (
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
      {wsState === 'connecting' && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <Wifi className="h-4 w-4 text-yellow-400 shrink-0 animate-pulse" />
          <p className="text-xs text-yellow-400">Connecting to agent...</p>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full px-8">
            <div className="text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-[#3f3f46] mx-auto" />
              <p className="text-sm text-[#71717a]">
                Send a message to start the conversation
              </p>
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
              <StreamingIndicator
                agentName={streamingAgentName || agentName}
                eventType={null}
              />
            )}
            <div ref={messagesEndRef} />
          </div>
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
          {/* Character count */}
          <div className="flex items-center justify-between px-3 pb-2 pt-0">
            <span
              className={cn(
                'text-[10px] font-mono',
                input.length > MAX_CHARS * 0.9
                  ? 'text-[#ef4444]'
                  : 'text-[#3f3f46]',
              )}
            >
              {input.length > 0
                ? `${input.length} / ${MAX_CHARS}`
                : ''}
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
