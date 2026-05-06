'use client'

import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed top-4 right-4 z-[100] flex max-h-screen w-full max-w-[380px] flex-col gap-2 p-0',
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg shadow-black/40 transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full duration-200',
  {
    variants: {
      variant: {
        default: 'bg-[#111111] border-[#1f1f1f] text-[#f4f4f5]',
        success: 'bg-[#111111] border-[#22c55e]/40 text-[#f4f4f5]',
        error:   'bg-[#111111] border-[#ef4444]/40 text-[#f4f4f5]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
))
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-[#1f1f1f] bg-transparent px-3 text-sm font-medium transition-colors hover:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#6366f1] disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-md p-1 text-[#71717a] transition-colors hover:text-[#f4f4f5] focus:outline-none focus:ring-2 focus:ring-[#6366f1]',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('text-sm font-semibold text-[#f4f4f5] leading-snug', className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-sm text-[#71717a] leading-snug mt-0.5', className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

// ── Toast state machine ──────────────────────────────────────────────────────

type ToastVariant = 'default' | 'success' | 'error'

interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  open: boolean
}

interface ToastOptions {
  title?: string
  description?: string
  variant?: ToastVariant
}

type ToastContextType = {
  toast: (opts: ToastOptions) => void
}

const ToastContext = React.createContext<ToastContextType | null>(null)

const _noop = () => {}
export function useToast(): ToastContextType {
  const ctx = React.useContext(ToastContext)
  if (!ctx) return { toast: _noop }
  return ctx
}

function VariantIcon({ variant }: { variant?: ToastVariant }) {
  if (variant === 'success') {
    return <CheckCircle2 className="h-5 w-5 text-[#22c55e] shrink-0 mt-0.5" />
  }
  if (variant === 'error') {
    return <AlertCircle className="h-5 w-5 text-[#ef4444] shrink-0 mt-0.5" />
  }
  return null
}

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const toast = React.useCallback((opts: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [
      ...prev,
      { id, title: opts.title, description: opts.description, variant: opts.variant ?? 'default', open: true },
    ])
  }, [])

  const handleOpenChange = React.useCallback((id: string, open: boolean) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, open } : t))
    )
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastProvider swipeDirection="right" duration={4500}>
        {toasts.map((t) => (
          <Toast
            key={t.id}
            open={t.open}
            onOpenChange={(open) => handleOpenChange(t.id, open)}
            variant={t.variant}
          >
            <VariantIcon variant={t.variant} />
            <div className="flex flex-col flex-1 pr-6">
              {t.title && <ToastTitle>{t.title}</ToastTitle>}
              {t.description && <ToastDescription>{t.description}</ToastDescription>}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  )
}

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  toastVariants,
}
