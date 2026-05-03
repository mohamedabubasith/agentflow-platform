'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import type { Agent, AgentCreate, AgentUpdate, AgentListResponse } from './types'

const BASE = '/api/v1'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body?.message ?? body?.detail ?? message
    } catch {}
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// Query keys
export const agentKeys = {
  all: ['agents'] as const,
  list: (skip: number, limit: number) => ['agents', 'list', skip, limit] as const,
  detail: (id: string) => ['agents', 'detail', id] as const,
}

// Hooks
export function useAgents(skip = 0, limit = 100): UseQueryResult<AgentListResponse> {
  return useQuery({
    queryKey: agentKeys.list(skip, limit),
    queryFn: () => fetchJSON<AgentListResponse>(`${BASE}/agents?skip=${skip}&limit=${limit}`),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}

export function useAgent(id: string): UseQueryResult<Agent> {
  return useQuery({
    queryKey: agentKeys.detail(id),
    queryFn: () => fetchJSON<Agent>(`${BASE}/agents/${id}`),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!id,
  })
}

export function useCreateAgent(): UseMutationResult<Agent, Error, AgentCreate> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AgentCreate) =>
      fetchJSON<Agent>(`${BASE}/agents`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all })
    },
  })
}

export function useUpdateAgent(): UseMutationResult<Agent, Error, { id: string; data: AgentUpdate }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) =>
      fetchJSON<Agent>(`${BASE}/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: (agent) => {
      qc.invalidateQueries({ queryKey: agentKeys.all })
      qc.setQueryData(agentKeys.detail(agent.id), agent)
    },
  })
}

export function useDeleteAgent(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<void>(`${BASE}/agents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all })
    },
  })
}

export async function checkHealth() {
  return fetchJSON<{ status: string; db: string; version: string }>(`${BASE}/health`)
}
