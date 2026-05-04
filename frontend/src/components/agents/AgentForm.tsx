'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, X, Copy, Upload, Download, AlertTriangle, FlaskConical } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Agent } from '@/lib/types'
import { agentFormSchema } from '@/lib/validators'
import type { AgentFormValues } from '@/lib/validators'
import { testMCPServer } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog } from '@/components/ui/dialog'
import { LLMConfig } from './LLMConfig'
import { MCPConfig } from './MCPConfig'

interface AgentFormProps {
  defaultValues?: Partial<AgentFormValues>
  onSubmit: (values: AgentFormValues) => void
  isLoading: boolean
  mode: 'create' | 'edit'
  existingAgents?: Agent[]
  currentAgent?: Agent
  onDuplicate?: (values: AgentFormValues) => void
}

const FORM_DEFAULTS: AgentFormValues = {
  name: '',
  description: '',
  system_prompt: '',
  llm_provider: 'openai',
  llm_model: 'gpt-4o',
  llm_temperature: 1.0,
  llm_max_tokens: 4096,
  llm_base_url: null,
  llm_api_key: null,
  mcp_servers: [],
  is_supervisor: false,
  worker_agent_ids: [],
}

// ── Test Agent Modal ───────────────────────────────────────────────────────

interface TestAgentModalProps {
  open: boolean
  onClose: () => void
  agentValues: AgentFormValues
}

function TestAgentModal({ open, onClose, agentValues }: TestAgentModalProps) {
  const [testMessage, setTestMessage] = React.useState('Hello! What can you do?')
  const [mcpResults, setMcpResults] = React.useState<
    { url: string; healthy: boolean; tools_count: number; error: string | null }[]
  >([])
  const [testing, setTesting] = React.useState(false)

  const handleTestMCP = async () => {
    setTesting(true)
    const results = await Promise.all(
      agentValues.mcp_servers.map((srv) =>
        testMCPServer(srv.url, srv.transport).then((r) => ({ url: srv.url, ...r })),
      ),
    )
    setMcpResults(results)
    setTesting(false)
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <div className="w-full max-w-lg rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1f1f]">
            <h2 className="text-sm font-semibold text-[#f4f4f5]">Test Agent Configuration</h2>
            <button onClick={onClose} className="text-[#71717a] hover:text-[#f4f4f5]">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Config summary */}
            <div className="rounded-lg bg-[#111111] border border-[#1f1f1f] p-3 space-y-2">
              <p className="text-xs font-medium text-[#71717a] uppercase tracking-wider">Configuration</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-[#71717a]">Provider</span>
                <span className="text-[#f4f4f5] font-mono">{agentValues.llm_provider}</span>
                <span className="text-[#71717a]">Model</span>
                <span className="text-[#f4f4f5] font-mono">{agentValues.llm_model}</span>
                <span className="text-[#71717a]">Temperature</span>
                <span className="text-[#f4f4f5] font-mono">{agentValues.llm_temperature}</span>
                <span className="text-[#71717a]">MCP Servers</span>
                <span className="text-[#f4f4f5] font-mono">{agentValues.mcp_servers.length}</span>
              </div>
              {!agentValues.llm_api_key && (
                <div className="flex items-center gap-1.5 mt-2 text-yellow-400 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>No API key set — will use server default</span>
                </div>
              )}
            </div>

            {/* MCP Health Check */}
            {agentValues.mcp_servers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-[#71717a] uppercase tracking-wider">MCP Health</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleTestMCP}
                    disabled={testing}
                    className="h-6 px-2 text-xs"
                  >
                    {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Test'}
                  </Button>
                </div>
                {mcpResults.length > 0 && (
                  <div className="space-y-1">
                    {mcpResults.map((r, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center justify-between rounded px-3 py-2 text-xs',
                          r.healthy ? 'bg-[#22c55e]/10 border border-[#22c55e]/20' : 'bg-[#ef4444]/10 border border-[#ef4444]/20',
                        )}
                      >
                        <span className="font-mono text-[#71717a] truncate max-w-[200px]">{r.url}</span>
                        {r.healthy ? (
                          <span className="text-[#22c55e] shrink-0">{r.tools_count} tools ✓</span>
                        ) : (
                          <span className="text-[#ef4444] shrink-0 truncate max-w-[120px]" title={r.error ?? ''}>
                            {r.error ?? 'Failed'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Test message */}
            <div className="space-y-1.5">
              <p className="text-xs text-[#71717a]">Test prompt (for reference — open chat to actually run)</p>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="resize-none text-sm"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end px-5 py-4 border-t border-[#1f1f1f]">
            <Button variant="secondary" size="md" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

// ── Main form ──────────────────────────────────────────────────────────────

export function AgentForm({
  defaultValues,
  onSubmit,
  isLoading,
  mode,
  existingAgents = [],
  currentAgent,
  onDuplicate,
}: AgentFormProps) {
  const router = useRouter()
  const [showTestModal, setShowTestModal] = React.useState(false)
  const importInputRef = React.useRef<HTMLInputElement>(null)

  const {
    control,
    watch,
    setValue,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: { ...FORM_DEFAULTS, ...defaultValues },
  })

  const systemPrompt = useWatch({ control, name: 'system_prompt' })
  const isSupervisor = useWatch({ control, name: 'is_supervisor' })
  const workerAgentIds = useWatch({ control, name: 'worker_agent_ids' })
  const mcpServers = useWatch({ control, name: 'mcp_servers' })
  const llmApiKey = useWatch({ control, name: 'llm_api_key' })
  const allValues = watch()

  function addWorker(agentId: string) {
    if (!workerAgentIds.includes(agentId)) {
      setValue('worker_agent_ids', [...workerAgentIds, agentId], { shouldValidate: true })
    }
  }

  function removeWorker(agentId: string) {
    setValue('worker_agent_ids', workerAgentIds.filter((id: string) => id !== agentId), {
      shouldValidate: true,
    })
  }

  const availableWorkers = existingAgents.filter((a) => !workerAgentIds.includes(a.id))
  const selectedWorkers = existingAgents.filter((a) => workerAgentIds.includes(a.id))

  // Export current form values as JSON
  const handleExport = () => {
    const exportData = { ...allValues, llm_api_key: null }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-${(allValues.name || 'config').replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import from JSON file
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        reset({ ...FORM_DEFAULTS, ...data, llm_api_key: null })
      } catch {
        // ignore malformed JSON
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Duplicate: call parent handler with current values + " (copy)" suffix
  const handleDuplicate = () => {
    onDuplicate?.({ ...allValues, name: `${allValues.name} (copy)` })
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {mode === 'edit' && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowTestModal(true)}
                  className="gap-1.5"
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  Test
                </Button>
                {onDuplicate && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleDuplicate}
                    className="gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplicate
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExport}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Import
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </div>

        {/* No API key warning */}
        {!llmApiKey && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
            <p className="text-xs text-yellow-300">
              No API key set — this agent will use the server&apos;s default key if available.
            </p>
          </div>
        )}

        {/* ── Section 1: Basic Info ── */}
        <section className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#f4f4f5] uppercase tracking-wider">
            Basic Info
          </h3>

          <div className="space-y-1.5">
            <label htmlFor="agent-name" className="text-sm text-[#71717a]">
              Name <span className="text-[#ef4444]">*</span>
            </label>
            <Input
              id="agent-name"
              {...register('name')}
              placeholder="e.g. Research Assistant"
              error={!!errors.name}
            />
            {errors.name && <p className="text-sm text-[#ef4444]">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="agent-description" className="text-sm text-[#71717a]">
              Description
            </label>
            <Textarea
              id="agent-description"
              {...register('description')}
              placeholder="Briefly describe what this agent does…"
              className="resize-none"
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-[#ef4444]">{errors.description.message}</p>
            )}
          </div>
        </section>

        {/* ── Section 2: System Prompt ── */}
        <section className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#f4f4f5] uppercase tracking-wider">
            System Prompt
          </h3>

          <div className="space-y-1.5">
            <label htmlFor="agent-system-prompt" className="text-sm text-[#71717a]">
              Instructions for the agent
            </label>
            <Textarea
              id="agent-system-prompt"
              {...register('system_prompt')}
              placeholder="You are a helpful assistant that…"
              className="min-h-[200px] resize-y font-mono text-sm"
            />
            <p className="text-xs text-[#71717a] text-right">
              {(systemPrompt ?? '').length} characters
            </p>
            {errors.system_prompt && (
              <p className="text-sm text-[#ef4444]">{errors.system_prompt.message}</p>
            )}
          </div>
        </section>

        {/* ── Section 3: LLM Configuration ── */}
        <LLMConfig control={control} watch={watch} setValue={setValue} />

        {/* ── Section 4: MCP Servers ── */}
        <MCPConfig
          value={mcpServers ?? []}
          onChange={(servers) => setValue('mcp_servers', servers, { shouldValidate: true })}
        />

        {/* ── Section 5: Agent Role ── */}
        <section className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#f4f4f5] uppercase tracking-wider">
            Agent Role
          </h3>

          <Controller
            control={control}
            name="is_supervisor"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-[#f4f4f5]">Supervisor Agent</p>
                  <p className="text-xs text-[#71717a]">
                    Can route tasks to worker agents and coordinate multi-agent flows
                  </p>
                </div>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Toggle supervisor agent"
                />
              </div>
            )}
          />

          {isSupervisor && existingAgents.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-[#1f1f1f]">
              <p className="text-sm text-[#71717a]">Worker Agents</p>

              {selectedWorkers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedWorkers.map((agent) => (
                    <span
                      key={agent.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40',
                        'bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300',
                      )}
                    >
                      {agent.name}
                      <button
                        type="button"
                        onClick={() => removeWorker(agent.id)}
                        className="rounded-full hover:text-indigo-100 transition-colors"
                        aria-label={`Remove ${agent.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {availableWorkers.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-[#71717a]">Add a worker agent:</p>
                  <div className="flex flex-wrap gap-2">
                    {availableWorkers.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => addWorker(agent.id)}
                        className={cn(
                          'inline-flex items-center rounded-full border border-[#1f1f1f]',
                          'bg-[#111111] px-3 py-1 text-xs text-[#71717a]',
                          'hover:border-indigo-500/50 hover:text-indigo-300 transition-colors',
                        )}
                      >
                        + {agent.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availableWorkers.length === 0 && selectedWorkers.length === 0 && (
                <p className="text-xs text-[#71717a]">
                  No other agents available to assign as workers.
                </p>
              )}

              {errors.worker_agent_ids && (
                <p className="text-sm text-[#ef4444]">{errors.worker_agent_ids.message}</p>
              )}
            </div>
          )}

          {isSupervisor && existingAgents.length === 0 && (
            <p className="text-xs text-[#71717a] pt-1 border-t border-[#1f1f1f]">
              Create other agents first to assign them as workers.
            </p>
          )}
        </section>

        {/* ── Footer actions ── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" size="md" onClick={() => router.back()} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="default" size="md" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Create Agent' : 'Save Changes'}
          </Button>
        </div>
      </form>

      <TestAgentModal
        open={showTestModal}
        onClose={() => setShowTestModal(false)}
        agentValues={allValues}
      />
    </>
  )
}
