'use client'

import * as React from 'react'
import * as SliderPrimitives from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

export interface SliderProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof SliderPrimitives.Root>,
    'value' | 'onValueChange'
  > {
  value?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitives.Root>,
  SliderProps
>(
  (
    { className, value, onValueChange, min = 0, max = 100, step = 1, ...props },
    ref
  ) => (
    <SliderPrimitives.Root
      ref={ref}
      className={cn(
        'relative flex w-full touch-none select-none items-center',
        className
      )}
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      {...props}
    >
      <SliderPrimitives.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[#1f1f1f]">
        <SliderPrimitives.Range className="absolute h-full bg-[#6366f1]" />
      </SliderPrimitives.Track>
      {(value ?? [0]).map((_, i) => (
        <SliderPrimitives.Thumb
          key={i}
          className={cn(
            'block h-4 w-4 rounded-full border-2 border-[#6366f1] bg-[#0a0a0a]',
            'shadow-sm shadow-black/50',
            'transition-colors',
            'hover:border-[#818cf8] hover:bg-[#111111]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]',
            'disabled:pointer-events-none disabled:opacity-50'
          )}
        />
      ))}
    </SliderPrimitives.Root>
  )
)
Slider.displayName = SliderPrimitives.Root.displayName

export { Slider }
