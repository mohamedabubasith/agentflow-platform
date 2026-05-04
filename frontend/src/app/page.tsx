'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Bot, Sparkles } from 'lucide-react'
import { useAgents, useCreateAgent } from '@/lib/api'
import type { AgentCreate } from '@/lib/types'
import { AgentCard } from '@/components/agents/AgentCard'
import { AgentImportExport } from '@/components/agents/AgentImportExport'
import { Header } from '@/components/layout/Header'
import { useToast } from '@/components/ui/toast'

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
        <Bot className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">No agents yet</h2>
      <p className="text-text-muted max-w-sm mb-8">
        Create your first AI agent to get started. Each agent can have its own LLM, tools, and system prompt.
      </p>
      <Link
        href="/agents/new"
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        Create your first agent
      </Link>
    </div>
  )
}

export default function HomePage() {
  const [search, setSearch] = useState('')
  const { data, isLoading, error } = useAgents()
  const createAgent = useCreateAgent()
  const { toast } = useToast()

  const handleImportAgents = async (agentsToImport: AgentCreate[]) => {
    let created = 0
    for (const a of agentsToImport) {
      try {
        await createAgent.mutateAsync(a)
        created++
      } catch {}
    }
    toast({ title: `Imported ${created} agent${created !== 1 ? 's' : ''}`, variant: 'success' })
  }

  const agents = useMemo(() => {
    const all = data?.items ?? []
    if (!search) return all
    const q = search.toLowerCase()
    return all.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    )
  }, [data, search])

  return (
    <div className="flex flex-col h-full">
      <Header title="Agents">
        <div className="flex items-center gap-3">
          <AgentImportExport
            agents={data?.items ?? []}
            onImport={handleImportAgents}
          />
          <Link
            href="/agents/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Agent
          </Link>
        </div>
      </Header>

      <div className="flex-1 p-6">
        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        {/* States */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-52 bg-surface border border-border rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-24 text-center">
            <Sparkles className="w-10 h-10 text-error mb-4" />
            <p className="text-error font-medium mb-1">Failed to load agents</p>
            <p className="text-text-muted text-sm">{(error as Error).message}</p>
          </div>
        ) : agents.length === 0 && !search ? (
          <EmptyState />
        ) : agents.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            No agents match &ldquo;{search}&rdquo;
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
