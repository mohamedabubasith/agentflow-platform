'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  children?: ReactNode
  className?: string
}

export function Header({ title, children, className }: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#1f1f1f] bg-[#0a0a0a] px-6',
        className
      )}
    >
      <h1 className="text-sm font-semibold text-[#f4f4f5] tracking-tight">
        {title}
      </h1>
      {children && (
        <div className="flex items-center gap-2">{children}</div>
      )}
    </header>
  )
}
