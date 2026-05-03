'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { MessageSquare, Pencil, Trash2, Loader2 } from 'lucide-react'

import { cn, formatDate } from '@/lib/utils'
import type { Agent } from '@/lib/types'
import { PROVIDER_LABELS } from '@/lib/types'
import { useDeleteAgent } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AgentCardProps {
  agent: Agent
}

export function AgentCard({ agent }: AgentCardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const deleteAgent = useDeleteAgent()
  const [alertOpen, setAlertOpen] = React.useState(false)

  const providerLabel = PROVIDER_LABELS[agent.llm_provider] ?? agent.llm_provider

  const mcpCount = agent.mcp_servers.length

  function handleDelete() {
    deleteAgent.mutate(agent.id, {
      onSuccess: () => {
        setAlertOpen(false)
        toast({ title: 'Agent deleted', variant: 'success' })
      },
      onError: (err: Error) => {
        toast({ title: 'Delete failed', description: err.message, variant: 'error' })
      },
    })
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-[#1f1f1f] bg-[#111111] p-5',
        'transition-colors hover:border-indigo-500/50'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-[#f4f4f5] leading-tight truncate">
            {agent.name}
          </h3>
          <p className="mt-1 text-sm text-[#71717a] line-clamp-2">
            {agent.description?.trim() ? agent.description : 'No description'}
          </p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{providerLabel}</Badge>
        {mcpCount > 0 ? (
          <Badge variant="default">{mcpCount} {mcpCount === 1 ? 'tool' : 'tools'}</Badge>
        ) : (
          <Badge variant="muted">No tools</Badge>
        )}
        {agent.is_supervisor && (
          <Badge variant="default">
            Supervisor
          </Badge>
        )}
      </div>

      {/* Created date */}
      <p className="text-xs text-[#71717a]">
        Created {formatDate(agent.created_at)}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button asChild size="sm" variant="default" className="flex-1">
          <Link href={`/agents/${agent.id}`}>
            <MessageSquare className="h-4 w-4" />
            Chat
          </Link>
        </Button>

        <Button
          asChild
          size="sm"
          variant="secondary"
          className="flex-1"
        >
          <Link href={`/agents/${agent.id}/edit`}>
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </Button>

        {/* Delete with confirmation */}
        <AlertDialog.Root open={alertOpen} onOpenChange={setAlertOpen}>
          <AlertDialog.Trigger asChild>
            <Button
              size="sm"
              variant="destructive"
              className="px-2.5"
              aria-label="Delete agent"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialog.Trigger>

          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <AlertDialog.Content
              className={cn(
                'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
                'rounded-lg border border-[#1f1f1f] bg-[#111111] p-6 shadow-2xl shadow-black/50',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
                'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'
              )}
            >
              <AlertDialog.Title className="text-base font-semibold text-[#f4f4f5]">
                Delete &ldquo;{agent.name}&rdquo;?
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm text-[#71717a]">
                This action cannot be undone. The agent and all its configuration will be
                permanently removed.
              </AlertDialog.Description>

              <div className="mt-6 flex justify-end gap-3">
                <AlertDialog.Cancel asChild>
                  <Button variant="secondary" size="sm" disabled={deleteAgent.isPending}>
                    Cancel
                  </Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteAgent.isPending}
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.preventDefault()
                      handleDelete()
                    }}
                  >
                    {deleteAgent.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Delete
                  </Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
    </div>
  )
}
