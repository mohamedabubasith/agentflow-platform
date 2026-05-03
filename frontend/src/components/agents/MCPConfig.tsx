'use client'

import * as React from 'react'
import { Plus, Trash2, CheckCircle2, XCircle, Loader2, ServerIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { MCPServer } from '@/lib/types'
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

type TransportType = MCPServer['transport']

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface MCPConfigProps {
  value: MCPServer[]
  onChange: (servers: MCPServer[]) => void
}

interface ServerTestState {
  status: TestStatus
}

const TRANSPORT_LABELS: Record<TransportType, string> = {
  sse: 'SSE',
  stdio: 'Stdio',
  websocket: 'WebSocket',
}

const TRANSPORT_OPTIONS: TransportType[] = ['sse', 'stdio', 'websocket']

function isValidUrl(str: string): boolean {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

async function testServerConnection(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)
  try {
    // Try HEAD first, fall back to GET
    let res = await fetch(url, { method: 'HEAD', signal: controller.signal })
    if (res.status === 405) {
      // HEAD not allowed — try GET
      const controller2 = new AbortController()
      const timeoutId2 = setTimeout(() => controller2.abort(), 5000)
      try {
        res = await fetch(url, { method: 'GET', signal: controller2.signal })
        clearTimeout(timeoutId2)
      } finally {
        clearTimeout(timeoutId2)
      }
    }
    clearTimeout(timeoutId)
    return res.ok || res.status < 500
  } catch {
    clearTimeout(timeoutId)
    return false
  }
}

export function MCPConfig({ value, onChange }: MCPConfigProps) {
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [testStates, setTestStates] = React.useState<Record<number, ServerTestState>>({})

  // Add form state
  const [newName, setNewName] = React.useState('')
  const [newUrl, setNewUrl] = React.useState('')
  const [newTransport, setNewTransport] = React.useState<TransportType>('sse')
  const [addErrors, setAddErrors] = React.useState<{ name?: string; url?: string }>({})

  function validateAddForm(): boolean {
    const errors: { name?: string; url?: string } = {}
    if (!newName.trim()) {
      errors.name = 'Name is required'
    }
    if (!newUrl.trim()) {
      errors.url = 'URL is required'
    } else if (!isValidUrl(newUrl.trim())) {
      errors.url = 'Must be a valid URL (include http:// or https://)'
    }
    setAddErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleAdd() {
    if (!validateAddForm()) return
    const server: MCPServer = {
      name: newName.trim(),
      url: newUrl.trim(),
      transport: newTransport,
    }
    onChange([...value, server])
    // Reset form
    setNewName('')
    setNewUrl('')
    setNewTransport('sse')
    setAddErrors({})
    setShowAddForm(false)
  }

  function handleCancel() {
    setNewName('')
    setNewUrl('')
    setNewTransport('sse')
    setAddErrors({})
    setShowAddForm(false)
  }

  function handleDelete(idx: number) {
    const next = value.filter((_, i) => i !== idx)
    onChange(next)
    // Clean up test state for removed index
    setTestStates((prev: Record<number, ServerTestState>) => {
      const updated: Record<number, ServerTestState> = {}
      Object.entries(prev).forEach(([k, v]: [string, ServerTestState]) => {
        const ki = parseInt(k, 10)
        if (ki < idx) updated[ki] = v
        else if (ki > idx) updated[ki - 1] = v
      })
      return updated
    })
  }

  async function handleTest(idx: number, url: string) {
    setTestStates((prev: Record<number, ServerTestState>) => ({ ...prev, [idx]: { status: 'testing' as const } }))
    const ok = await testServerConnection(url)
    setTestStates((prev: Record<number, ServerTestState>) => ({ ...prev, [idx]: { status: (ok ? 'success' : 'error') as TestStatus } }))
    // Auto-reset after 4 s
    setTimeout(() => {
      setTestStates((prev: Record<number, ServerTestState>) => {
        const next = { ...prev }
        delete next[idx]
        return next
      })
    }, 4000)
  }

  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#f4f4f5] uppercase tracking-wider">
          MCP Servers
        </h3>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setShowAddForm(true)}
          disabled={showAddForm}
        >
          <Plus className="h-4 w-4" />
          Add Server
        </Button>
      </div>

      {/* Server list */}
      {value.length === 0 && !showAddForm ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <ServerIcon className="h-8 w-8 text-[#2f2f2f]" />
          <p className="text-sm text-[#71717a]">
            No MCP servers — agent will use LLM only
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {value.map((server, idx) => {
            const testState = testStates[idx]
            const isTesting = testState?.status === 'testing'
            const testStatus = testState?.status ?? 'idle'

            return (
              <li
                key={idx}
                className="flex items-center gap-3 rounded-md border border-[#1f1f1f] bg-[#111111] px-3 py-2.5"
              >
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#f4f4f5] truncate">
                    {server.name}
                  </p>
                  <p className="text-xs text-[#71717a] truncate mt-0.5">{server.url}</p>
                </div>

                {/* Transport badge */}
                <Badge variant="muted" className="shrink-0">
                  {TRANSPORT_LABELS[server.transport]}
                </Badge>

                {/* Test status indicator */}
                {testStatus === 'success' && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22c55e]" aria-label="Connection successful" />
                )}
                {testStatus === 'error' && (
                  <XCircle className="h-4 w-4 shrink-0 text-[#ef4444]" aria-label="Connection failed" />
                )}

                {/* Test button */}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isTesting}
                  onClick={() => handleTest(idx, server.url)}
                  className="shrink-0 h-7 px-2 text-xs"
                >
                  {isTesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Test'
                  )}
                </Button>

                {/* Delete button */}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(idx)}
                  className="shrink-0 h-7 w-7 p-0 text-[#71717a] hover:text-[#ef4444]"
                  aria-label={`Remove ${server.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Inline add form */}
      {showAddForm && (
        <div className="rounded-md border border-[#1f1f1f] bg-[#111111] p-4 space-y-3">
          <p className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">
            New MCP Server
          </p>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm text-[#71717a]">Name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. filesystem"
              error={!!addErrors.name}
            />
            {addErrors.name && (
              <p className="text-xs text-[#ef4444]">{addErrors.name}</p>
            )}
          </div>

          {/* URL */}
          <div className="space-y-1">
            <label className="text-sm text-[#71717a]">URL</label>
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://mcp.example.com/sse"
              error={!!addErrors.url}
            />
            {addErrors.url && (
              <p className="text-xs text-[#ef4444]">{addErrors.url}</p>
            )}
          </div>

          {/* Transport */}
          <div className="space-y-1">
            <label className="text-sm text-[#71717a]">Transport</label>
            <Select
              value={newTransport}
              onValueChange={(v) => setNewTransport(v as TransportType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSPORT_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSPORT_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Form actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="button" size="sm" variant="default" onClick={handleAdd}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
