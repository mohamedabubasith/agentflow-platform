'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Bot,
  Brain,
  Wrench,
  CheckCircle,
  ArrowRightLeft,
  CheckCheck,
  XCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
} from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import type { AgentEvent } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type FilterType = 'all' | 'tools' | 'routing' | 'errors'

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tools', label: 'Tools' },
  { value: 'routing', label: 'Routing' },
  { value: 'errors', label: 'Errors' },
]

function matchesFilter(event: AgentEvent, filter: FilterType): boolean {
  if (filter === 'all') return true
  if (filter === 'tools') return event.type === 'tool_call' || event.type === 'tool_result'
  if (filter === 'routing') return event.type === 'supervisor_routing'
  if (filter === 'errors') return event.type === 'error'
  return true
}

function formatEventTime(isoOrNow?: string): string {
  const d = isoOrNow ? new Date(isoOrNow) : new Date()
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

// ── Copy-to-clipboard helper ───────────────────────────────────────────────

function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false)
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [])
  return [copied, copy]
}

// ── ExpandableJson with copy button ───────────────────────────────────────

interface ExpandableJsonProps {
  label: string
  data: unknown
}

function ExpandableJson({ label, data }: ExpandableJsonProps) {
  const [expanded, setExpanded] = useState(false)
  const [, copy] = useCopy()
  const text = JSON.stringify(data, null, 2)

  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[#71717a] hover:text-[#f4f4f5] transition-colors"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span>{label}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); copy(text) }}
          className="ml-1 text-[#3f3f46] hover:text-[#71717a] transition-colors"
          title="Copy JSON"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
      {expanded && (
        <pre className="mt-1 ml-4 p-2 rounded bg-[#0d0d0d] border border-[#1f1f1f] text-[10px] text-[#a1a1aa] overflow-x-auto max-w-full whitespace-pre-wrap break-all">
          {text}
        </pre>
      )}
    </div>
  )
}

// ── EventRow ───────────────────────────────────────────────────────────────

interface EventRowProps {
  event: AgentEvent
}

function EventRow({ event }: EventRowProps) {
  if (
    event.type === 'token' ||
    event.type === 'done' ||
    event.type === 'connected' ||
    event.type === 'ping' ||
    event.type === 'server_restart'
  ) {
    return null
  }

  const timestamp = 'timestamp' in event ? (event as { timestamp?: string }).timestamp : undefined
  const baseClass = 'font-mono text-xs leading-relaxed'

  const renderContent = () => {
    switch (event.type) {
      case 'agent_start':
        return (
          <div className="flex items-start gap-1.5">
            <Bot className="h-3.5 w-3.5 text-[#818cf8] shrink-0 mt-0.5" />
            <span className={cn(baseClass, 'text-[#818cf8]')}>
              Agent started: {event.agent_name}
            </span>
          </div>
        )

      case 'thinking':
        return (
          <div className="flex items-start gap-1.5">
            <Brain className="h-3.5 w-3.5 text-[#71717a] shrink-0 mt-0.5" />
            <span className={cn(baseClass, 'text-[#71717a]')}>
              {event.content.length > 100 ? `${event.content.slice(0, 100)}…` : event.content}
            </span>
          </div>
        )

      case 'tool_call':
        return (
          <div className="flex items-start gap-1.5">
            <Wrench className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
            <div className={cn(baseClass, 'text-yellow-400')}>
              <ExpandableJson label={`Calling: ${event.tool_name}`} data={event.tool_input} />
            </div>
          </div>
        )

      case 'tool_result':
        return (
          <div className="flex items-start gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-[#22c55e] shrink-0 mt-0.5" />
            <div className={cn(baseClass, 'text-[#22c55e]')}>
              <ExpandableJson label={`${event.tool_name} returned`} data={event.result} />
            </div>
          </div>
        )

      case 'supervisor_routing':
        return (
          <div className="flex items-start gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />
            <span className={cn(baseClass, 'text-purple-400')}>
              → {event.to_agent}
              {event.reason && <span className="text-[#71717a] ml-1">({event.reason})</span>}
            </span>
          </div>
        )

      case 'agent_end':
        return (
          <div className="flex items-start gap-1.5">
            <CheckCheck className="h-3.5 w-3.5 text-[#22c55e] shrink-0 mt-0.5" />
            <span className={cn(baseClass, 'text-[#22c55e]')}>Completed</span>
          </div>
        )

      case 'error':
        return (
          <div className="flex items-start gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-[#ef4444] shrink-0 mt-0.5" />
            <span className={cn(baseClass, 'text-[#ef4444]')}>{event.message}</span>
          </div>
        )

      default:
        return null
    }
  }

  const content = renderContent()
  if (!content) return null

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-1.5 hover:bg-[#111111] rounded transition-colors">
      <div className="flex-1 min-w-0">{content}</div>
      <span className="font-mono text-[10px] text-[#3f3f46] shrink-0 mt-0.5 tabular-nums">
        {formatEventTime(timestamp)}
      </span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

const SKIP_TYPES = new Set(['token', 'done', 'connected', 'ping', 'server_restart'])

export function AgentEventLog() {
  const events = useChatStore((s) => s.events)
  const clearEvents = useChatStore((s) => s.clearEvents)

  const [filter, setFilter] = useState<FilterType>('all')

  const visibleEvents = events.filter(
    (e) => !SKIP_TYPES.has(e.type) && matchesFilter(e, filter),
  )

  const useVirtualized = visibleEvents.length > 100
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!useVirtualized && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [visibleEvents.length, useVirtualized])

  const virtualizer = useVirtualizer({
    count: useVirtualized ? visibleEvents.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: useCallback(() => 36, []),
    overscan: 10,
  })

  useEffect(() => {
    if (useVirtualized && visibleEvents.length > 0) {
      virtualizer.scrollToIndex(visibleEvents.length - 1, { behavior: 'smooth' })
    }
  }, [visibleEvents.length, useVirtualized, virtualizer])

  const handleExport = () => {
    const all = events.filter((e) => !SKIP_TYPES.has(e.type))
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-events-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Count by category for filter badges
  const toolCount = events.filter((e) => e.type === 'tool_call' || e.type === 'tool_result').length
  const routingCount = events.filter((e) => e.type === 'supervisor_routing').length
  const errorCount = events.filter((e) => e.type === 'error').length

  const filterCount: Record<FilterType, number> = {
    all: events.filter((e) => !SKIP_TYPES.has(e.type)).length,
    tools: toolCount,
    routing: routingCount,
    errors: errorCount,
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-[#1f1f1f]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f1f1f] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#71717a] uppercase tracking-wider">
            Event Log
          </span>
          {filterCount.all > 0 && (
            <span className="text-[10px] font-mono text-[#3f3f46] bg-[#111111] border border-[#1f1f1f] rounded-full px-1.5 py-0.5">
              {filterCount.all}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {filterCount.all > 0 && (
            <button
              onClick={handleExport}
              className="h-6 px-2 text-[10px] text-[#71717a] hover:text-[#f4f4f5] flex items-center gap-1 rounded transition-colors"
              title="Export events as JSON"
            >
              <Download className="h-3 w-3" />
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearEvents}
            className="h-6 px-2 text-[10px] text-[#71717a] hover:text-[#f4f4f5]"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-[#1f1f1f] shrink-0">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
              filter === opt.value
                ? 'bg-[#1f1f1f] text-[#f4f4f5]'
                : 'text-[#71717a] hover:text-[#f4f4f5]',
            )}
          >
            {opt.label}
            {filterCount[opt.value] > 0 && (
              <span className="text-[#3f3f46] font-mono">{filterCount[opt.value]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Events */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {visibleEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full px-4 py-8">
            <p className="text-xs text-[#3f3f46] font-mono text-center">
              No events yet.
              <br />
              Events will appear here during agent execution.
            </p>
          </div>
        ) : useVirtualized ? (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const event = visibleEvents[vItem.index]
              return (
                <div
                  key={vItem.key}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vItem.start}px)`,
                  }}
                >
                  <EventRow event={event} />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-1">
            {visibleEvents.map((event, idx) => (
              <EventRow key={idx} event={event} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
