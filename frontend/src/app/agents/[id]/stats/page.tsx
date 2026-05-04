'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart2, Clock, Zap, TrendingUp, Wrench, Trash2, Loader2 } from 'lucide-react'
import { useAgent, useAgentRunStats, useAgentRuns, useClearAgentRuns } from '@/lib/api'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
}

function StatCard({ icon, label, value, sub, color }: StatCardProps) {
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-4 space-y-2">
      <div className={cn('flex items-center gap-2 text-xs text-[#71717a] uppercase tracking-wider', color)}>
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-[#f4f4f5] tabular-nums">{value}</p>
      {sub && <p className="text-xs text-[#3f3f46]">{sub}</p>}
    </div>
  )
}

export default function AgentStatsPage({ params }: { params: { id: string } }) {
  const { data: agent, isLoading: agentLoading } = useAgent(params.id)
  const { data: stats, isLoading: statsLoading } = useAgentRunStats(params.id)
  const { data: runs, isLoading: runsLoading } = useAgentRuns(params.id, 0, 20)
  const clearRuns = useClearAgentRuns()
  const [clearConfirm, setClearConfirm] = useState(false)

  const isLoading = agentLoading || statsLoading || runsLoading

  const handleClearRuns = async () => {
    await clearRuns.mutateAsync(params.id)
    setClearConfirm(false)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Stats" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Stats" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[#71717a]">Agent not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      <Header title={`${agent.name} — Stats`} />

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Back + actions */}
        <div className="flex items-center justify-between">
          <Link
            href={`/agents/${params.id}`}
            className="flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#f4f4f5] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to chat
          </Link>
          <div className="flex items-center gap-2">
            {!clearConfirm ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setClearConfirm(true)}
                className="gap-1.5 text-[#ef4444] hover:text-[#ef4444]"
                disabled={!stats || stats.total_runs === 0}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear history
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#ef4444]">Delete all run history?</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleClearRuns}
                  disabled={clearRuns.isPending}
                  className="text-[#ef4444] border-[#ef4444]/30 hover:bg-[#ef4444]/10"
                >
                  {clearRuns.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setClearConfirm(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<BarChart2 className="h-3.5 w-3.5" />}
            label="Total Runs"
            value={stats?.total_runs ?? 0}
            sub={`${stats?.runs_last_7_days ?? 0} in last 7 days`}
            color="text-[#818cf8]"
          />
          <StatCard
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Total Tokens"
            value={(stats?.total_tokens ?? 0).toLocaleString()}
            sub={`avg ${Math.round((stats?.total_tokens ?? 0) / Math.max(stats?.total_runs ?? 1, 1)).toLocaleString()} / run`}
            color="text-yellow-400"
          />
          <StatCard
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Avg Duration"
            value={formatMs(stats?.avg_duration_ms ?? 0)}
            color="text-[#22c55e]"
          />
          <StatCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Last 7 Days"
            value={stats?.runs_last_7_days ?? 0}
            sub="runs"
            color="text-purple-400"
          />
        </div>

        {/* Most-used tools */}
        {stats && stats.most_used_tools.length > 0 && (
          <section className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[#f4f4f5] flex items-center gap-2">
              <Wrench className="h-4 w-4 text-yellow-400" />
              Most Used Tools
            </h3>
            <div className="space-y-2">
              {stats.most_used_tools.map((tool, i) => {
                const maxCount = stats.most_used_tools[0]?.count ?? 1
                const pct = Math.round((tool.count / maxCount) * 100)
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[#f4f4f5]">{tool.name}</span>
                      <span className="text-[#71717a] tabular-nums">{tool.count}×</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1f1f1f] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-yellow-400/60 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Recent runs table */}
        <section className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1f1f1f] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#f4f4f5]">Recent Runs</h3>
            <span className="text-xs text-[#71717a]">Showing latest 20</span>
          </div>

          {!runs || runs.items.length === 0 ? (
            <div className="flex items-center justify-center px-5 py-12">
              <p className="text-sm text-[#3f3f46]">No runs yet. Start a chat to see history here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1f1f1f] text-[#71717a] uppercase tracking-wider">
                    <th className="px-4 py-2 text-left font-medium">Time</th>
                    <th className="px-4 py-2 text-left font-medium">User Message</th>
                    <th className="px-4 py-2 text-right font-medium">Tokens</th>
                    <th className="px-4 py-2 text-right font-medium">Duration</th>
                    <th className="px-4 py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.items.map((run) => (
                    <tr
                      key={run.id}
                      className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-[#71717a] whitespace-nowrap">
                        {formatDate(run.created_at)}
                      </td>
                      <td className="px-4 py-2.5 text-[#f4f4f5] max-w-[280px]">
                        <span className="block truncate">{run.user_message}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#71717a] tabular-nums">
                        {run.total_tokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#71717a] tabular-nums whitespace-nowrap">
                        {formatMs(run.duration_ms)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {run.error ? (
                          <span className="inline-block rounded-full bg-[#ef4444]/20 text-[#ef4444] px-2 py-0.5 text-[10px]">
                            Error
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-[#22c55e]/20 text-[#22c55e] px-2 py-0.5 text-[10px]">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
