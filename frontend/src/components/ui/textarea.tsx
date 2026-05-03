import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  autoResize?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, autoResize = false, onChange, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement | null>(null)

    const setRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        internalRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref]
    )

    const handleResize = React.useCallback(
      (el: HTMLTextAreaElement) => {
        if (!autoResize) return
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      },
      [autoResize]
    )

    React.useEffect(() => {
      if (autoResize && internalRef.current) {
        handleResize(internalRef.current)
      }
    }, [autoResize, handleResize, props.value])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize) {
        handleResize(e.target)
      }
      onChange?.(e)
    }

    return (
      <textarea
        className={cn(
          'flex w-full rounded-md border bg-[#111111] px-3 py-2 text-sm text-[#f4f4f5] placeholder:text-[#71717a] shadow-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'min-h-[80px] resize-y',
          autoResize && 'resize-none overflow-hidden',
          error
            ? 'border-[#ef4444] focus-visible:ring-[#ef4444]'
            : 'border-[#1f1f1f] hover:border-[#2f2f2f]',
          className
        )}
        ref={setRef}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
