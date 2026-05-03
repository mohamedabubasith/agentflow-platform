import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[#6366f1]/20 text-[#818cf8] border border-[#6366f1]/30',
        success: 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30',
        warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
        error:   'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30',
        muted:   'bg-[#111111] text-[#71717a] border border-[#1f1f1f]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
