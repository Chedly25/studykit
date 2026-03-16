import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Bot } from 'lucide-react'
import type { Message } from '../../ai/types'
import { parseCitations, CitationBadge, type Citation } from './SourceCitation'

interface Props {
  message: Message
  onCitationClick?: (citation: Citation) => void
}

export function ChatMessageBubble({ message, onCitationClick }: Props) {
  const isUser = message.role === 'user'
  const content = typeof message.content === 'string' ? message.content : ''

  // Skip messages with only tool_use/tool_result blocks
  if (!content && Array.isArray(message.content)) {
    const hasText = message.content.some(b => 'type' in b && b.type === 'text' && 'text' in b && b.text)
    if (!hasText) return null
  }

  const text = typeof message.content === 'string'
    ? message.content
    : message.content
        .filter(b => 'type' in b && b.type === 'text' && 'text' in b)
        .map(b => ('text' in b ? b.text : ''))
        .join('')

  // Parse citations from assistant messages
  const citations = useMemo(() => isUser ? [] : parseCitations(text), [text, isUser])
  const textWithoutCitations = useMemo(() => {
    if (citations.length === 0) return text
    let cleaned = text
    citations.forEach(c => {
      cleaned = cleaned.replace(c.fullMatch, `[^${citations.indexOf(c) + 1}]`)
    })
    return cleaned
  }, [text, citations])

  if (!text) return null

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[var(--accent-bg)] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-[var(--accent-text)]" />
        </div>
      )}
      <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${
        isUser
          ? 'bg-[var(--accent-text)] text-white'
          : 'bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-body)]'
      }`}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{text}</p>
        ) : (
          <>
            <div className="text-sm prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-code:text-[var(--accent-text)] prose-code:bg-[var(--accent-bg)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{textWithoutCitations}</ReactMarkdown>
            </div>
            {citations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[var(--border-card)]">
                {citations.map((citation, i) => (
                  <CitationBadge
                    key={i}
                    citation={citation}
                    index={i}
                    onClick={() => onCitationClick?.(citation)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-[var(--bg-input)] border border-[var(--border-card)] flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
      )}
    </div>
  )
}
