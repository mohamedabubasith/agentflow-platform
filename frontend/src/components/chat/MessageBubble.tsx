'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Copy, Check } from 'lucide-react'
import type { Components } from 'react-markdown'
import type { ConversationMessage } from '@/lib/types'
import { cn } from '@/lib/utils'

// Dynamic import for ReactMarkdown to avoid SSR issues
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })

// Dynamic import for SyntaxHighlighter to avoid SSR issues
const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter').then((mod) => mod.Prism),
  { ssr: false },
)

// Dynamic import for the atomDark theme
const getAtomDark = () =>
  import('react-syntax-highlighter/dist/cjs/styles/prism/atom-dark').then(
    (mod) => mod.default,
  )

interface CodeBlockProps {
  language: string
  children: string
}

function CodeBlock({ language, children }: CodeBlockProps) {
  const [style, setStyle] = useState<Record<string, React.CSSProperties> | null>(null)
  const [copied, setCopied] = useState(false)

  // Load the theme on first render
  useEffect(() => {
    getAtomDark().then(setStyle)
  }, [])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [children])

  return (
    <div className="relative group/code my-2 rounded-md overflow-hidden border border-[#1f1f1f]">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 p-1 rounded bg-[#1f1f1f] opacity-0 group-hover/code:opacity-100 transition-opacity text-[#71717a] hover:text-[#f4f4f5]"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-[#22c55e]" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      {style ? (
        <SyntaxHighlighter
          language={language || 'text'}
          style={style}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            background: '#0d0d0d',
            fontSize: '0.75rem',
            lineHeight: '1.5',
          }}
          codeTagProps={{ style: { fontFamily: 'var(--font-geist-mono), Menlo, monospace' } }}
        >
          {children}
        </SyntaxHighlighter>
      ) : (
        <pre
          className="overflow-x-auto p-4 text-xs font-mono bg-[#0d0d0d] text-[#f4f4f5]"
        >
          <code>{children}</code>
        </pre>
      )}
    </div>
  )
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

interface MessageBubbleProps {
  message: ConversationMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [message.content])

  // Markdown component overrides
  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? '')
      const isInline = !match
      const codeContent = String(children).replace(/\n$/, '')

      if (isInline) {
        return (
          <code
            className="rounded px-1 py-0.5 text-xs font-mono bg-[#1f1f1f] text-[#818cf8]"
            {...props}
          >
            {children}
          </code>
        )
      }

      return <CodeBlock language={match[1]}>{codeContent}</CodeBlock>
    },
    p({ children }) {
      return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
    },
    ul({ children }) {
      return <ul className="mb-2 list-disc pl-4 space-y-1">{children}</ul>
    },
    ol({ children }) {
      return <ol className="mb-2 list-decimal pl-4 space-y-1">{children}</ol>
    },
    li({ children }) {
      return <li className="leading-relaxed">{children}</li>
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-[#6366f1] pl-3 my-2 text-[#71717a] italic">
          {children}
        </blockquote>
      )
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#818cf8] underline underline-offset-2 hover:text-[#6366f1]"
        >
          {children}
        </a>
      )
    },
    h1({ children }) {
      return <h1 className="text-base font-semibold mb-2 text-[#f4f4f5]">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="text-sm font-semibold mb-2 text-[#f4f4f5]">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="text-sm font-medium mb-1 text-[#f4f4f5]">{children}</h3>
    },
    hr() {
      return <hr className="border-[#1f1f1f] my-3" />
    },
    table({ children }) {
      return (
        <div className="overflow-x-auto my-2">
          <table className="w-full text-xs border-collapse">{children}</table>
        </div>
      )
    },
    th({ children }) {
      return (
        <th className="border border-[#1f1f1f] px-2 py-1 text-left font-medium text-[#f4f4f5] bg-[#1a1a1a]">
          {children}
        </th>
      )
    },
    td({ children }) {
      return (
        <td className="border border-[#1f1f1f] px-2 py-1 text-[#a1a1aa]">{children}</td>
      )
    },
  }

  return (
    <div
      className={cn(
        'group flex',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div className={cn('relative max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={cn(
            'absolute top-2 z-10 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity',
            'bg-[#1f1f1f] text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#2a2a2a]',
            isUser ? 'right-2' : 'right-2',
          )}
          aria-label="Copy message"
        >
          {copied
            ? <Check className="h-3.5 w-3.5 text-[#22c55e]" />
            : <Copy className="h-3.5 w-3.5" />
          }
        </button>

        {/* Bubble */}
        <div
          className={cn(
            'px-4 py-3 text-sm',
            isUser
              ? [
                  'bg-[#6366f1]/10 border border-[#6366f1]/20',
                  'rounded-2xl rounded-tr-sm',
                  'text-[#f4f4f5]',
                ]
              : [
                  'bg-[#111111] border border-[#1f1f1f]',
                  'rounded-2xl rounded-tl-sm',
                  'text-[#f4f4f5]',
                ],
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown components={components}>
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-px h-4 bg-[#f4f4f5] ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <p
          className={cn(
            'mt-1 text-[10px] text-[#71717a] px-1',
            isUser ? 'text-right' : 'text-left',
          )}
        >
          {formatTimestamp(message.timestamp)}
        </p>
      </div>
    </div>
  )
}
