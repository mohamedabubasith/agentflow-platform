import { create } from 'zustand'
import type { Agent } from '@/lib/types'

interface AgentStore {
  selectedAgentId: string | null
  searchQuery: string
  setSelectedAgentId: (id: string | null) => void
  setSearchQuery: (q: string) => void
  filterAgents: (agents: Agent[]) => Agent[]
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  selectedAgentId: null,
  searchQuery: '',
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  filterAgents: (agents) => {
    const q = get().searchQuery.toLowerCase()
    if (!q) return agents
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    )
  },
}))
