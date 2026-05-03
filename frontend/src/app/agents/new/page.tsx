'use client'

import { useRouter } from 'next/navigation'
import { useCreateAgent } from '@/lib/api'
import { AgentForm } from '@/components/agents/AgentForm'
import { Header } from '@/components/layout/Header'
import type { AgentFormValues } from '@/lib/validators'

export default function NewAgentPage() {
  const router = useRouter()
  const createAgent = useCreateAgent()

  async function handleSubmit(values: AgentFormValues) {
    await createAgent.mutateAsync({
      ...values,
      llm_base_url: values.llm_base_url ?? null,
      llm_api_key: values.llm_api_key ?? null,
    })
    router.push('/')
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="New Agent" />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <AgentForm
            mode="create"
            onSubmit={handleSubmit}
            isLoading={createAgent.isPending}
          />
        </div>
      </div>
    </div>
  )
}
