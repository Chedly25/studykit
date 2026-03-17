import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, Loader2 } from 'lucide-react'
import type { Message } from '../../ai/types'
import { parseCitations, CitationBadge, type Citation } from './SourceCitation'
import { StudyPlanCanvas } from './StudyPlanCanvas'

const CANVAS_MARKER = '[canvas:study-plan]'
const CANVAS_PARTIAL = '[canvas:'

interface Props {
  message: Message
  onCitationClick?: (citation: Citation) => void
  isStreaming?: boolean
}

export function ChatMessageBubble({ message, onCitationClick, isStreaming }: Props) {
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

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[var(--accent-bg)] border border-[var(--border-card)] text-[var(--text-body)]">
          <p className="text-base whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    )
  }

  // Detect canvas markers in assistant messages
  const hasCanvasMarker = textWithoutCitations.includes(CANVAS_MARKER)
  const hasPartialCanvas = !hasCanvasMarker && textWithoutCitations.includes(CANVAS_PARTIAL)

  // During streaming: show placeholder for partial marker
  const renderContent = useMemo(() => {
    if (hasCanvasMarker) {
      const segments = textWithoutCitations.split(CANVAS_MARKER)
      return { textBefore: null, showPlaceholder: false, segments }
    }
    if (isStreaming && hasPartialCanvas) {
      const idx = textWithoutCitations.indexOf(CANVAS_PARTIAL)
      return { textBefore: textWithoutCitations.slice(0, idx), showPlaceholder: true, segments: null }
    }
    return { textBefore: null, showPlaceholder: false, segments: null }
  }, [textWithoutCitations, isStreaming, hasCanvasMarker, hasPartialCanvas])

  const proseClass = `text-base prose prose-base max-w-none dark:prose-invert prose-p:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-3 prose-code:text-[var(--accent-text)] prose-code:bg-[var(--accent-bg)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded ${isStreaming ? 'streaming-cursor' : ''}`

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-[var(--accent-bg)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-4 h-4 text-[var(--accent-text)]" />
      </div>
      <div className="max-w-none py-1 text-[var(--text-body)] min-w-0 flex-1">
        {renderContent.segments ? (
          // Non-streaming with canvas markers: interleave text and canvas components
          <div>
            {renderContent.segments.map((segment, i) => (
              <div key={i}>
                {segment.trim() && (
                  <div className={proseClass}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{segment}</ReactMarkdown>
                  </div>
                )}
                {i < renderContent.segments!.length - 1 && <StudyPlanCanvas />}
              </div>
            ))}
          </div>
        ) : renderContent.showPlaceholder ? (
          // Streaming with partial canvas marker: show text before + placeholder
          <div>
            {renderContent.textBefore && renderContent.textBefore.trim() && (
              <div className={proseClass}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{renderContent.textBefore}</ReactMarkdown>
              </div>
            )}
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--accent-bg)] my-2">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" />
              <span className="text-sm text-[var(--accent-text)]">Setting up plan builder...</span>
            </div>
          </div>
        ) : (
          // Normal message rendering
          <div className={proseClass}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{textWithoutCitations}</ReactMarkdown>
          </div>
        )}
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
      </div>
    </div>
  )
}
