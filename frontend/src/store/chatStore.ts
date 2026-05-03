import { create } from 'zustand'
import type { AgentEvent, ConversationMessage, MCPOverrideEntry, WSConnectionState } from '@/lib/types'

interface ChatStore {
  messages: ConversationMessage[]
  events: AgentEvent[]
  wsState: WSConnectionState
  isStreaming: boolean
  streamingAgentName: string
  currentStreamingId: string | null
  mcpOverrides: MCPOverrideEntry[]

  addMessage: (msg: ConversationMessage) => void
  appendToken: (id: string, token: string) => void
  finalizeMessage: (id: string, content: string) => void
  addEvent: (event: AgentEvent) => void
  setWsState: (state: WSConnectionState) => void
  setIsStreaming: (v: boolean) => void
  setStreamingAgentName: (name: string) => void
  setCurrentStreamingId: (id: string | null) => void
  setMcpOverrides: (overrides: MCPOverrideEntry[]) => void
  clearMessages: () => void
  clearEvents: () => void
  reset: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  events: [],
  wsState: 'disconnected',
  isStreaming: false,
  streamingAgentName: '',
  currentStreamingId: null,
  mcpOverrides: [],

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  appendToken: (id, token) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + token } : m,
      ),
    })),

  finalizeMessage: (id, content) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content, isStreaming: false } : m,
      ),
    })),

  addEvent: (event) =>
    set((s) => ({ events: [...s.events, event] })),

  setWsState: (wsState) => set({ wsState }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setStreamingAgentName: (streamingAgentName) => set({ streamingAgentName }),
  setCurrentStreamingId: (currentStreamingId) => set({ currentStreamingId }),
  setMcpOverrides: (mcpOverrides) => set({ mcpOverrides }),
  clearMessages: () => set({ messages: [] }),
  clearEvents: () => set({ events: [] }),
  reset: () =>
    set({
      messages: [],
      events: [],
      wsState: 'disconnected',
      isStreaming: false,
      streamingAgentName: '',
      currentStreamingId: null,
      mcpOverrides: [],
    }),
}))
