import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Bot, Loader2, FileText } from 'lucide-react'
import type { Message } from '../../ai/types'
import { parseCitations, CitationBadge, type Citation } from './SourceCitation'
import { StudyPlanCanvas } from './StudyPlanCanvas'
import { ConceptCardBlock } from './ConceptCardBlock'
import { InlineQuiz } from './InlineQuiz'
import { CodePlaygroundBlock } from './CodePlaygroundBlock'
import { MessageFeedback } from './MessageFeedback'

const CANVAS_MARKER = '[canvas:study-plan]'
const CARD_RE = /\[card:([a-f0-9-]+)\]/g
const QUIZ_RE = /\[quiz:([a-f0-9-]+)\]/g
const ANY_MARKER_RE = /\[(?:card|quiz|code):([a-f0-9-]+)\]|\[canvas:study-plan\]/g
const PARTIAL_MARKER_RE = /\[(?:card|quiz|code|canvas)(?::[^\]]*)?$/

interface Props {
  message: Message
  messageIndex?: number
  conversationId?: string
  examProfileId?: string
  onCitationClick?: (citation: Citation) => void
  isStreaming?: boolean
}

export function ChatMessageBubble({ message, messageIndex, conversationId, examProfileId, onCitationClick, isStreaming }: Props) {
  const isUser = message.role === 'user'
  const content = typeof message.content === 'string' ? message.content : ''

  // Check if message has visible text (computed before hooks to use as guard later)
  const hasVisibleText = (() => {
    if (!content && Array.isArray(message.content)) {
      return message.content.some(b => 'type' in b && b.type === 'text' && 'text' in b && b.text)
    }
    return true
  })()

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

  // Parse text into segments: text + rich markers (canvas, card, quiz)
  type Segment = { type: 'text'; content: string } | { type: 'canvas' } | { type: 'card'; id: string } | { type: 'quiz'; id: string } | { type: 'code'; id: string }

  const segments = useMemo((): Segment[] => {
    const src = textWithoutCitations
    // Check for partial marker during streaming — show text before it + placeholder
    if (isStreaming && PARTIAL_MARKER_RE.test(src)) {
      const match = src.match(PARTIAL_MARKER_RE)
      if (match && match.index !== undefined) {
        return [{ type: 'text', content: src.slice(0, match.index) }]
      }
    }

    const result: Segment[] = []
    let lastIndex = 0
    // Reset regex state
    ANY_MARKER_RE.lastIndex = 0

    let m: RegExpExecArray | null
    while ((m = ANY_MARKER_RE.exec(src)) !== null) {
      // Text before this marker
      if (m.index > lastIndex) {
        result.push({ type: 'text', content: src.slice(lastIndex, m.index) })
      }
      const full = m[0]
      if (full === CANVAS_MARKER) {
        result.push({ type: 'canvas' })
      } else if (full.startsWith('[card:')) {
        const id = full.match(CARD_RE.source)?.[0]?.slice(6, -1) ?? m[1]
        result.push({ type: 'card', id })
      } else if (full.startsWith('[quiz:')) {
        const id = full.match(QUIZ_RE.source)?.[0]?.slice(6, -1) ?? m[1]
        result.push({ type: 'quiz', id })
      } else if (full.startsWith('[code:')) {
        result.push({ type: 'code', id: m[1] })
      }
      lastIndex = m.index + full.length
    }
    // Remaining text
    if (lastIndex < src.length) {
      result.push({ type: 'text', content: src.slice(lastIndex) })
    }
    return result.length > 0 ? result : [{ type: 'text', content: src }]
  }, [textWithoutCitations, isStreaming])

  const showStreamingPlaceholder = isStreaming && PARTIAL_MARKER_RE.test(textWithoutCitations)

  const proseClass = `text-base prose prose-base max-w-none dark:prose-invert prose-p:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-3 prose-code:text-[var(--accent-text)] prose-code:bg-[var(--accent-bg)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded ${isStreaming ? 'streaming-cursor' : ''}`

  // Early returns — placed after all hooks to satisfy rules-of-hooks
  if (!hasVisibleText) return null
  if (!text) return null

  if (isUser) {
    const ctxRe = /<<CTX:(.+?)>>[\s\S]*?<<\/CTX>>\n?/g
    const contextLabels: string[] = []
    let userText = text
    let match: RegExpExecArray | null
    while ((match = ctxRe.exec(text)) !== null) {
      contextLabels.push(match[1])
    }
    if (contextLabels.length > 0) {
      userText = text.replace(/<<CTX:.+?>>[\s\S]*?<<\/CTX>>\n?/g, '').trim()
    }

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[var(--accent-bg)] border border-[var(--border-card)] text-[var(--text-body)]">
          {contextLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {contextLabels.map((label) => (
                <span key={label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  <FileText className="w-2.5 h-2.5" />
                  {label}
                </span>
              ))}
            </div>
          )}
          <p className="text-base whitespace-pre-wrap">{userText}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 group">
      <div className="w-8 h-8 rounded-full bg-[var(--accent-bg)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-4 h-4 text-[var(--accent-text)]" />
      </div>
      <div className="max-w-none py-1 text-[var(--text-body)] min-w-0 flex-1">
        <div>
          {segments.map((seg, i) => {
            if (seg.type === 'text' && seg.content.trim()) {
              return (
                <div key={`${seg.type}-${i}`} className={proseClass}>
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{seg.content}</ReactMarkdown>
                </div>
              )
            }
            if (seg.type === 'canvas') return <StudyPlanCanvas key={`${seg.type}-${i}`} />
            if (seg.type === 'card') return <ConceptCardBlock key={`${seg.type}-${i}`} cardId={seg.id} />
            if (seg.type === 'quiz') return <InlineQuiz key={`${seg.type}-${i}`} quizId={seg.id} />
            if (seg.type === 'code') return <CodePlaygroundBlock key={`${seg.type}-${i}`} codeId={seg.id} />
            return null
          })}
          {showStreamingPlaceholder && (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--accent-bg)] my-2">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" />
              <span className="text-sm text-[var(--accent-text)]">Preparing...</span>
            </div>
          )}
        </div>
        {citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[var(--border-card)]">
            {citations.map((citation, i) => (
              <CitationBadge
                key={`cite-${i}`}
                citation={citation}
                index={i}
                onClick={() => onCitationClick?.(citation)}
              />
            ))}
          </div>
        )}
        {!isStreaming && conversationId && examProfileId && messageIndex !== undefined && (
          <MessageFeedback
            messageIndex={messageIndex}
            conversationId={conversationId}
            examProfileId={examProfileId}
          />
        )}
      </div>
    </div>
  )
}
