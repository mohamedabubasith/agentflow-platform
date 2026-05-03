'use client'

import * as React from 'react'
import { Controller, useController } from 'react-hook-form'
import type { Control, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'

import { cn } from '@/lib/utils'
import { PROVIDER_MODELS, PROVIDER_LABELS } from '@/lib/types'
import type { LLMProvider } from '@/lib/types'
import type { AgentFormValues } from '@/lib/validators'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LLMConfigProps {
  control: Control<AgentFormValues>
  watch: UseFormWatch<AgentFormValues>
  setValue: UseFormSetValue<AgentFormValues>
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5',
  google: 'gemini-2.0-flash',
  openai_compatible: '',
}

const PROVIDERS: LLMProvider[] = ['openai', 'anthropic', 'google', 'openai_compatible']

export function LLMConfig({ control, watch, setValue }: LLMConfigProps) {
  const [showApiKey, setShowApiKey] = React.useState(false)

  const provider = watch('llm_provider')
  const temperature = watch('llm_temperature')

  const {
    fieldState: { error: providerError },
  } = useController({ control, name: 'llm_provider' })

  const {
    fieldState: { error: modelError },
  } = useController({ control, name: 'llm_model' })

  const {
    fieldState: { error: baseUrlError },
  } = useController({ control, name: 'llm_base_url' })

  function handleProviderChange(newProvider: LLMProvider, rhfOnChange: (v: LLMProvider) => void) {
    rhfOnChange(newProvider)
    const defaultModel = DEFAULT_MODELS[newProvider]
    setValue('llm_model', defaultModel, { shouldValidate: true })
    // Reset base_url when switching away from openai_compatible
    if (newProvider !== 'openai_compatible') {
      setValue('llm_base_url', null)
    }
  }

  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-5 space-y-5">
      <h3 className="text-sm font-semibold text-[#f4f4f5] uppercase tracking-wider">
        LLM Configuration
      </h3>

      {/* Provider */}
      <div className="space-y-1.5">
        <label className="text-sm text-[#71717a]">Provider</label>
        <Controller
          control={control}
          name="llm_provider"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val) =>
                handleProviderChange(val as LLMProvider, field.onChange)
              }
            >
              <SelectTrigger className={cn(providerError && 'border-[#ef4444]')}>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {providerError && (
          <p className="text-xs text-[#ef4444]">{providerError.message}</p>
        )}
      </div>

      {/* Model */}
      <div className="space-y-1.5">
        <label className="text-sm text-[#71717a]">Model</label>
        {provider !== 'openai_compatible' ? (
          <Controller
            control={control}
            name="llm_model"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className={cn(modelError && 'border-[#ef4444]')}>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_MODELS[provider]?.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        ) : (
          <Controller
            control={control}
            name="llm_model"
            render={({ field }) => (
              <Input
                {...field}
                placeholder="e.g. llama-3.1-70b"
                error={!!modelError}
              />
            )}
          />
        )}
        {modelError && (
          <p className="text-xs text-[#ef4444]">{modelError.message}</p>
        )}
      </div>

      {/* Temperature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-[#71717a]">Temperature</label>
          <span className="text-sm font-medium text-[#f4f4f5] tabular-nums w-8 text-right">
            {typeof temperature === 'number' ? temperature.toFixed(1) : '1.0'}
          </span>
        </div>
        <Controller
          control={control}
          name="llm_temperature"
          render={({ field }) => (
            <Slider
              min={0}
              max={2}
              step={0.1}
              value={[field.value ?? 1.0]}
              onValueChange={([val]) => field.onChange(val)}
            />
          )}
        />
        <div className="flex justify-between text-xs text-[#71717a]">
          <span>Precise (0)</span>
          <span>Creative (2)</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div className="space-y-1.5">
        <label className="text-sm text-[#71717a]">Max Tokens</label>
        <Controller
          control={control}
          name="llm_max_tokens"
          render={({ field, fieldState }) => (
            <>
              <Input
                type="number"
                min={1}
                max={128000}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
                onBlur={field.onBlur}
                error={!!fieldState.error}
                placeholder="4096"
              />
              {fieldState.error && (
                <p className="text-xs text-[#ef4444]">{fieldState.error.message}</p>
              )}
            </>
          )}
        />
      </div>

      {/* Base URL — only shown for openai_compatible */}
      {provider === 'openai_compatible' && (
        <div className="space-y-1.5">
          <label className="text-sm text-[#71717a]">Base URL</label>
          <Controller
            control={control}
            name="llm_base_url"
            render={({ field }) => (
              <Input
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value || null)}
                onBlur={field.onBlur}
                placeholder="https://api.example.com/v1"
                error={!!baseUrlError}
              />
            )}
          />
          {baseUrlError && (
            <p className="text-xs text-[#ef4444]">{baseUrlError.message}</p>
          )}
        </div>
      )}

      {/* API Key */}
      <div className="space-y-1.5">
        <label className="text-sm text-[#71717a]">API Key</label>
        <Controller
          control={control}
          name="llm_api_key"
          render={({ field, fieldState }) => (
            <>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  onBlur={field.onBlur}
                  placeholder="Leave empty to use server default"
                  error={!!fieldState.error}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#f4f4f5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] rounded-sm"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {fieldState.error && (
                <p className="text-xs text-[#ef4444]">{fieldState.error.message}</p>
              )}
            </>
          )}
        />
      </div>
    </div>
  )
}
