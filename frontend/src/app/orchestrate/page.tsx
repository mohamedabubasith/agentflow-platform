'use client'

import { useState, useMemo } from 'react'
import { Network, ChevronRight } from 'lucide-react'
import { useAgents } from '@/lib/api'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { AgentEventLog } from '@/components/chat/AgentEventLog'
import { Header } from '@/components/layout/Header'
import { generateConversationId } from '@/lib/utils'
import type { Agent } from '@/lib/types'

function AgentSelector({
  agents,
  selected,
  onSelect,
}: {
  agents: Agent[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  const supervisors = agents.filter((a) => a.is_supervisor)

  return (
    <div className="flex flex-col h-full p-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
        <Network className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Build a Team</h2>
      <p className="text-text-muted text-sm mb-8">
        Select a supervisor agent to start a multi-agent conversation.
      </p>

      {supervisors.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-lg">
          <p className="text-text-muted text-sm mb-2">No supervisor agents found.</p>
          <p className="text-text-muted text-xs">
            Create an agent and enable &ldquo;Supervisor Agent&rdquo; to use orchestration.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {supervisors.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                selected === agent.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-surface hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">{agent.name}</p>
                  <p className="text-text-muted text-sm mt-0.5">
                    {agent.worker_agent_ids.length} worker agent
                    {agent.worker_agent_ids.length !== 1 ? 's' : ''} ·{' '}
                    {agent.llm_model}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrchestratePage() {
  const { data, isLoading } = useAgents()
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null)
  const conversationId = useMemo(() => generateConversationId(), [])

  const selectedAgent = data?.items.find((a) => a.id === selectedSupervisorId)

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Orchestrate" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Orchestrate" />
      <div className="flex flex-1 overflow-hidden">
        {!selectedSupervisorId || !selectedAgent ? (
          <div className="flex-1">
            <AgentSelector
              agents={data?.items ?? []}
              selected={selectedSupervisorId}
              onSelect={setSelectedSupervisorId}
            />
          </div>
        ) : (
          <>
            {/* Chat panel */}
            <div className="flex-[7] overflow-hidden border-r border-border">
              <ChatWindow
                agentId={selectedAgent.id}
                conversationId={conversationId}
                agentName={selectedAgent.name}
                llmModel={selectedAgent.llm_model}
              />
            </div>
            {/* Event log */}
            <div className="flex-[3] overflow-hidden">
              <AgentEventLog />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
