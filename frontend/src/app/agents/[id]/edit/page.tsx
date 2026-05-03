'use client'

import { useRouter } from 'next/navigation'
import { useAgent, useUpdateAgent, useAgents } from '@/lib/api'
import { AgentForm } from '@/components/agents/AgentForm'
import { Header } from '@/components/layout/Header'
import type { AgentFormValues } from '@/lib/validators'

export default function EditAgentPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { data: agent, isLoading } = useAgent(params.id)
  const { data: agentsData } = useAgents()
  const updateAgent = useUpdateAgent()

  async function handleSubmit(values: AgentFormValues) {
    await updateAgent.mutateAsync({
      id: params.id,
      data: {
        ...values,
        llm_base_url: values.llm_base_url ?? null,
        llm_api_key: values.llm_api_key ?? null,
      },
    })
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Edit Agent" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Edit Agent" />
        <div className="flex-1 flex items-center justify-center text-text-muted">
          Agent not found.
        </div>
      </div>
    )
  }

  const otherAgents = agentsData?.items.filter((a) => a.id !== params.id) ?? []

  return (
    <div className="flex flex-col h-full">
      <Header title={`Edit: ${agent.name}`} />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <AgentForm
            mode="edit"
            defaultValues={{
              name: agent.name,
              description: agent.description,
              system_prompt: agent.system_prompt,
              llm_provider: agent.llm_provider as AgentFormValues['llm_provider'],
              llm_model: agent.llm_model,
              llm_temperature: agent.llm_temperature,
              llm_max_tokens: agent.llm_max_tokens,
              llm_base_url: agent.llm_base_url ?? undefined,
              llm_api_key: undefined,
              mcp_servers: agent.mcp_servers,
              is_supervisor: agent.is_supervisor,
              worker_agent_ids: agent.worker_agent_ids,
            }}
            onSubmit={handleSubmit}
            isLoading={updateAgent.isPending}
            existingAgents={otherAgents}
          />
        </div>
      </div>
    </div>
  )
}
