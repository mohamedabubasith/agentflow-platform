'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, X, Plus, Server } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import type { MCPOverrideEntry } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Transport = MCPOverrideEntry['transport']

const TRANSPORT_OPTIONS: { value: Transport; label: string }[] = [
  { value: 'sse', label: 'SSE' },
  { value: 'websocket', label: 'WebSocket' },
  { value: 'stdio', label: 'stdio' },
]

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'ws:' || u.protocol === 'wss:'
  } catch {
    return false
  }
}

const TRANSPORT_BADGE_VARIANT: Record<Transport, 'default' | 'warning' | 'muted'> = {
  sse: 'default',
  websocket: 'warning',
  stdio: 'muted',
}

export function MCPOverride() {
  const mcpOverrides = useChatStore((s) => s.mcpOverrides)
  const setMcpOverrides = useChatStore((s) => s.setMcpOverrides)

  const [expanded, setExpanded] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [transport, setTransport] = useState<Transport>('sse')
  const [urlError, setUrlError] = useState(false)

  const handleAdd = () => {
    if (!name.trim()) return
    if (!isValidUrl(url.trim())) {
      setUrlError(true)
      return
    }
    setUrlError(false)
    const entry: MCPOverrideEntry = {
      name: name.trim(),
      url: url.trim(),
      transport,
    }
    setMcpOverrides([...mcpOverrides, entry])
    setName('')
    setUrl('')
    setTransport('sse')
  }

  const handleRemove = (index: number) => {
    setMcpOverrides(mcpOverrides.filter((_, i) => i !== index))
  }

  const handleUrlChange = (v: string) => {
    setUrl(v)
    if (urlError) setUrlError(false)
  }

  return (
    <div className="border-b border-[#1f1f1f]">
      {/* Collapsed banner when overrides active */}
      {!expanded && mcpOverrides.length > 0 && (
        <div className="px-3 py-1.5 bg-[#6366f1]/10 border-b border-[#6366f1]/20">
          <p className="text-xs text-[#818cf8] font-mono">
            Using {mcpOverrides.length} runtime MCP server{mcpOverrides.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#111111] transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5" />
          <span>MCP Server Overrides</span>
          {mcpOverrides.length > 0 && (
            <span className="font-mono text-[10px] text-[#818cf8] bg-[#6366f1]/10 border border-[#6366f1]/20 rounded-full px-1.5 py-0.5">
              {mcpOverrides.length}
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        }
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Active overrides list */}
          {mcpOverrides.length > 0 && (
            <div className="space-y-1.5">
              {mcpOverrides.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-[#111111] border border-[#1f1f1f] rounded-md px-2.5 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-[#f4f4f5] truncate">
                        {entry.name}
                      </span>
                      <Badge variant={TRANSPORT_BADGE_VARIANT[entry.transport]}>
                        {entry.transport}
                      </Badge>
                    </div>
                    <p className="text-[10px] font-mono text-[#71717a] truncate">
                      {entry.url}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(idx)}
                    className="shrink-0 p-1 rounded text-[#71717a] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                    aria-label={`Remove ${entry.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new form */}
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-medium text-[#3f3f46] uppercase tracking-wider">
              Add server
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd()
                }}
              />
              <Select
                value={transport}
                onValueChange={(v) => setTransport(v as Transport)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="https://your-mcp-server.com/sse"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                error={urlError}
                className={cn('h-8 text-xs flex-1')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd()
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAdd}
                disabled={!name.trim() || !url.trim()}
                className="h-8 px-3 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="sr-only">Add</span>
              </Button>
            </div>
            {urlError && (
              <p className="text-[10px] text-[#ef4444] font-mono">
                Please enter a valid URL (http/https/ws/wss)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
