'use client'

import { useRef, useState } from 'react'
import { Download, Upload, CheckCircle, XCircle } from 'lucide-react'
import type { Agent, AgentCreate } from '@/lib/types'
import { Button } from '@/components/ui/button'

interface AgentImportExportProps {
  agents: Agent[]
  onImport: (agents: AgentCreate[]) => Promise<void>
}

export function AgentImportExport({ agents, onImport }: AgentImportExportProps) {
  const importRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')

  const handleExportAll = () => {
    const exportData = agents.map((agent) => ({
      name: agent.name,
      description: agent.description,
      system_prompt: agent.system_prompt,
      llm_provider: agent.llm_provider,
      llm_model: agent.llm_model,
      llm_temperature: agent.llm_temperature,
      llm_max_tokens: agent.llm_max_tokens,
      llm_base_url: agent.llm_base_url,
      llm_api_key: null,
      mcp_servers: agent.mcp_servers,
      is_supervisor: agent.is_supervisor,
      worker_agent_ids: [],
    }))
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agentflow-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const agentsToImport: AgentCreate[] = Array.isArray(data) ? data : [data]

      if (agentsToImport.length === 0) throw new Error('No agents found in file')

      await onImport(agentsToImport)
      setImportStatus('success')
      setImportMessage(`Imported ${agentsToImport.length} agent${agentsToImport.length > 1 ? 's' : ''}`)
    } catch (err) {
      setImportStatus('error')
      setImportMessage(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setTimeout(() => setImportStatus('idle'), 3000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {importStatus !== 'idle' && (
        <span
          className={
            importStatus === 'success'
              ? 'flex items-center gap-1 text-xs text-[#22c55e]'
              : 'flex items-center gap-1 text-xs text-[#ef4444]'
          }
        >
          {importStatus === 'success' ? (
            <CheckCircle className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {importMessage}
        </span>
      )}

      <Button
        variant="secondary"
        size="sm"
        onClick={handleExportAll}
        disabled={agents.length === 0}
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        Export all
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => importRef.current?.click()}
        className="gap-1.5"
      >
        <Upload className="h-3.5 w-3.5" />
        Import
      </Button>

      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImport}
      />
    </div>
  )
}
