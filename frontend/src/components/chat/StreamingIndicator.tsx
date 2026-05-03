'use client'

import { cn } from '@/lib/utils'

interface StreamingIndicatorProps {
  agentName: string
  eventType: string | null
}

function getDisplayText(agentName: string, eventType: string | null): string {
  switch (eventType) {
    case 'agent_start':
      return `${agentName} is starting...`
    case 'thinking':
      return `${agentName} is thinking...`
    case 'tool_call':
      return `${agentName} is calling a tool...`
    case 'tool_result':
      return 'Processing result...'
    default:
      return `${agentName} is working...`
  }
}

export function StreamingIndicator({ agentName, eventType }: StreamingIndicatorProps) {
  const text = getDisplayText(agentName, eventType)

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'inline-block h-1.5 w-1.5 rounded-full bg-[#71717a] animate-[pulseDot_1.4s_infinite_ease-in-out]',
            )}
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-[#71717a] font-mono">{text}</span>
    </div>
  )
}
