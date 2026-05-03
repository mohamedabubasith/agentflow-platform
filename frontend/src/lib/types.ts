export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'openai_compatible'

export interface MCPServer {
  name: string
  url: string
  transport: 'sse' | 'stdio' | 'websocket'
}

export interface Agent {
  id: string
  name: string
  description: string
  system_prompt: string
  llm_provider: LLMProvider
  llm_model: string
  llm_temperature: number
  llm_max_tokens: number
  llm_base_url: string | null
  llm_api_key: null
  mcp_servers: MCPServer[]
  is_supervisor: boolean
  worker_agent_ids: string[]
  created_at: string
  updated_at: string
}

export interface AgentCreate {
  name: string
  description: string
  system_prompt: string
  llm_provider: LLMProvider
  llm_model: string
  llm_temperature: number
  llm_max_tokens: number
  llm_base_url?: string | null
  llm_api_key?: string | null
  mcp_servers: MCPServer[]
  is_supervisor: boolean
  worker_agent_ids: string[]
}

export type AgentUpdate = Partial<AgentCreate>

export interface AgentListResponse {
  items: Agent[]
  total: number
  skip: number
  limit: number
}

// WebSocket event types
export interface WSEventConnected {
  type: 'connected'
  agent_id: string
  conversation_id: string
}

export interface WSEventAgentStart {
  type: 'agent_start'
  agent_name: string
  timestamp: string
}

export interface WSEventThinking {
  type: 'thinking'
  agent_name: string
  content: string
}

export interface WSEventToolCall {
  type: 'tool_call'
  agent_name: string
  tool_name: string
  tool_input: Record<string, unknown>
}

export interface WSEventToolResult {
  type: 'tool_result'
  agent_name: string
  tool_name: string
  result: string
  duration_ms?: number
}

export interface WSEventSupervisorRouting {
  type: 'supervisor_routing'
  from_agent: string
  to_agent: string
  reason?: string
}

export interface WSEventAgentEnd {
  type: 'agent_end'
  agent_name: string
  timestamp: string
}

export interface WSEventToken {
  type: 'token'
  content: string
}

export interface WSEventDone {
  type: 'done'
  full_response: string
  total_duration_ms: number
  tokens_used: number
}

export interface WSEventError {
  type: 'error'
  code: string
  message: string
}

export interface WSEventPing {
  type: 'ping'
}

export type AgentEvent =
  | WSEventConnected
  | WSEventAgentStart
  | WSEventThinking
  | WSEventToolCall
  | WSEventToolResult
  | WSEventSupervisorRouting
  | WSEventAgentEnd
  | WSEventToken
  | WSEventDone
  | WSEventError
  | WSEventPing

export type WSConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
}

export interface MCPOverrideEntry {
  name: string
  url: string
  transport: 'sse' | 'stdio' | 'websocket'
}

export const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  openai_compatible: [],
}

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  openai_compatible: 'OpenAI Compatible',
}
