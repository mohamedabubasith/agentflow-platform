'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Agent } from '@/lib/types'
import { agentFormSchema } from '@/lib/validators'
import type { AgentFormValues } from '@/lib/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { LLMConfig } from './LLMConfig'
import { MCPConfig } from './MCPConfig'

interface AgentFormProps {
  defaultValues?: Partial<AgentFormValues>
  onSubmit: (values: AgentFormValues) => void
  isLoading: boolean
  mode: 'create' | 'edit'
  existingAgents?: Agent[]
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

export function AgentForm({
  defaultValues,
  onSubmit,
  isLoading,
  mode,
  existingAgents = [],
}: AgentFormProps) {
  const router = useRouter()

  const {
    control,
    watch,
    setValue,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      ...FORM_DEFAULTS,
      ...defaultValues,
    },
  })

  const systemPrompt = useWatch({ control, name: 'system_prompt' })
  const isSupervisor = useWatch({ control, name: 'is_supervisor' })
  const workerAgentIds = useWatch({ control, name: 'worker_agent_ids' })
  const mcpServers = useWatch({ control, name: 'mcp_servers' })

  // Worker agent multi-select helpers
  function addWorker(agentId: string) {
    if (!workerAgentIds.includes(agentId)) {
      setValue('worker_agent_ids', [...workerAgentIds, agentId], {
        shouldValidate: true,
      })
    }
  }

  function removeWorker(agentId: string) {
    setValue(
      'worker_agent_ids',
      workerAgentIds.filter((id: string) => id !== agentId),
      { shouldValidate: true }
    )
  }

  // Available agents to add as workers (exclude already-selected ones)
  const availableWorkers = existingAgents.filter(
    (a) => !workerAgentIds.includes(a.id)
  )

  const selectedWorkers = existingAgents.filter((a) =>
    workerAgentIds.includes(a.id)
  )

  function handleFormSubmit(values: AgentFormValues) {
    onSubmit(values)
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-6"
      noValidate
    >
      {/* ── Section 1: Basic Info ── */}
      <section className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[#f4f4f5] uppercase tracking-wider">
          Basic Info
        </h3>

        {/* Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="agent-name"
            className="text-sm text-[#71717a]"
          >
            Name <span className="text-[#ef4444]">*</span>
          </label>
          <Input
            id="agent-name"
            {...register('name')}
            placeholder="e.g. Research Assistant"
            error={!!errors.name}
          />
          {errors.name && (
            <p className="text-sm text-[#ef4444]">{errors.name.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label
            htmlFor="agent-description"
            className="text-sm text-[#71717a]"
          >
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
          <label
            htmlFor="agent-system-prompt"
            className="text-sm text-[#71717a]"
          >
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
        onChange={(servers) =>
          setValue('mcp_servers', servers, { shouldValidate: true })
        }
      />

      {/* ── Section 5: Agent Role ── */}
      <section className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[#f4f4f5] uppercase tracking-wider">
          Agent Role
        </h3>

        {/* Supervisor toggle */}
        <Controller
          control={control}
          name="is_supervisor"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-[#f4f4f5]">
                  Supervisor Agent
                </p>
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

        {/* Worker agents picker — only visible when supervisor is on */}
        {isSupervisor && existingAgents.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-[#1f1f1f]">
            <p className="text-sm text-[#71717a]">Worker Agents</p>

            {/* Selected worker chips */}
            {selectedWorkers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedWorkers.map((agent) => (
                  <span
                    key={agent.id}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40',
                      'bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300'
                    )}
                  >
                    {agent.name}
                    <button
                      type="button"
                      onClick={() => removeWorker(agent.id)}
                      className="rounded-full hover:text-indigo-100 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                      aria-label={`Remove ${agent.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add worker dropdown (simple select) */}
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
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]'
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
              <p className="text-sm text-[#ef4444]">
                {errors.worker_agent_ids.message}
              </p>
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
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="default"
          size="md"
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create Agent' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
