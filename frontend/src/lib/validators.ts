import { z } from 'zod'

export const mcpServerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  url: z.string().url('Must be a valid URL'),
  transport: z.enum(['sse', 'stdio', 'websocket']).default('sse'),
})

export const agentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  description: z.string().default(''),
  system_prompt: z.string().default(''),
  llm_provider: z.enum(['openai', 'anthropic', 'google', 'openai_compatible']),
  llm_model: z.string().min(1, 'Model is required').max(100),
  llm_temperature: z.number().min(0).max(2),
  llm_max_tokens: z.number().int().min(1).max(128000),
  llm_base_url: z.string().url('Must be a valid URL').nullable().optional(),
  llm_api_key: z.string().nullable().optional(),
  mcp_servers: z.array(mcpServerSchema).default([]),
  is_supervisor: z.boolean().default(false),
  worker_agent_ids: z.array(z.string().uuid()).default([]),
})

export type AgentFormValues = z.infer<typeof agentFormSchema>

export const chatInputSchema = z.object({
  message: z.string().min(1).max(32000),
})

export const mcpOverrideSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Must be a valid URL'),
  transport: z.enum(['sse', 'stdio', 'websocket']).default('sse'),
})
