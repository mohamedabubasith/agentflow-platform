'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Network, Github } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  external?: boolean
}

const primaryNavItems: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: LayoutGrid,
  },
  {
    label: 'Orchestrate',
    href: '/orchestrate',
    icon: Network,
  },
]

const bottomNavItems: NavItem[] = [
  {
    label: 'GitHub',
    href: 'https://github.com',
    icon: Github,
    external: true,
  },
]

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const linkProps = item.external
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {}

  return (
    <Link
      href={item.href}
      {...linkProps}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-[#6366f1]/15 text-[#818cf8]'
          : 'text-[#71717a] hover:bg-[#111111] hover:text-[#f4f4f5]'
      )}
    >
      <item.icon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors duration-150',
          isActive ? 'text-[#6366f1]' : 'text-current'
        )}
      />
      {item.label}
      {item.external && (
        <svg
          className="ml-auto h-3 w-3 shrink-0 opacity-50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      )}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-[#1f1f1f] bg-[#0a0a0a]">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-[#1f1f1f] px-5">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#6366f1]/20">
            <Network className="h-4 w-4 text-[#6366f1]" />
          </div>
          <span className="text-sm font-semibold text-[#6366f1] tracking-tight">
            agentflow
          </span>
        </Link>
      </div>

      {/* Primary navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {primaryNavItems.map((item) => (
            <li key={item.href}>
              <NavLink item={item} isActive={isActive(item.href)} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom navigation */}
      <div className="border-t border-[#1f1f1f] px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {bottomNavItems.map((item) => (
            <li key={item.href}>
              <NavLink item={item} isActive={false} />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
