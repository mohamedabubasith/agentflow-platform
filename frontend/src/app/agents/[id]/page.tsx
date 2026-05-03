'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAgent } from '@/lib/api'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { AgentEventLog } from '@/components/chat/AgentEventLog'
import { Header } from '@/components/layout/Header'
import { generateConversationId } from '@/lib/utils'

export default function AgentChatPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { data: agent, isLoading } = useAgent(params.id)
  const conversationId = useMemo(() => generateConversationId(), [])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Chat" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!agent) {
    router.push('/')
    return null
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={agent.name} />
      <div className="flex flex-1 overflow-hidden">
        {/* Chat panel - 70% */}
        <div className="flex-[7] overflow-hidden border-r border-border">
          <ChatWindow
            agentId={agent.id}
            conversationId={conversationId}
            agentName={agent.name}
            llmModel={agent.llm_model}
          />
        </div>
        {/* Event log - 30% */}
        <div className="flex-[3] overflow-hidden">
          <AgentEventLog />
        </div>
      </div>
    </div>
  )
}
