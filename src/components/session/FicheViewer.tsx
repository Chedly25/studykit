/**
 * Full-page/modal markdown renderer for a single concept card fiche.
 * Renders card.content (rich markdown) or falls back to legacy keyPoints + example.
 */
import { X, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type { ConceptCard } from '../../db/schema'

interface FicheViewerProps {
  card: ConceptCard
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  onQuizMe?: (topic: string) => void
  hasPrev?: boolean
  hasNext?: boolean
}

export function FicheViewer({ card, onClose, onPrev, onNext, onQuizMe, hasPrev, hasNext }: FicheViewerProps) {
  // Build display content: prefer rich markdown, fall back to legacy
  let displayContent: string
  if (card.content) {
    displayContent = card.content
  } else {
    // Legacy card → build readable markdown from keyPoints + example
    let keyPoints: string[] = []
    try { keyPoints = JSON.parse(card.keyPoints) } catch { /* ignore */ }

    const parts: string[] = [`# ${card.title}`]
    if (keyPoints.length > 0) {
      parts.push('\n## Key Points')
      parts.push(keyPoints.map(p => `- ${p}`).join('\n'))
    }
    if (card.example) {
      parts.push('\n## Example')
      parts.push(card.example)
    }
    if (card.sourceReference) {
      parts.push('\n## Source')
      parts.push(card.sourceReference)
    }
    displayContent = parts.join('\n')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-card)]">
          <h2 className="text-lg font-bold text-[var(--text-heading)] truncate flex-1">{card.title}</h2>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {onQuizMe && (
              <button
                onClick={() => onQuizMe(card.title)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-bg)] text-[var(--accent-text)] hover:opacity-80 transition-opacity"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Quiz me
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-input)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="prose prose-sm max-w-none text-[var(--text-body)]
            prose-headings:text-[var(--text-heading)] prose-headings:font-bold
            prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2
            prose-h3:text-sm prose-h3:mt-4
            prose-p:text-sm prose-p:leading-relaxed
            prose-li:text-sm
            prose-strong:text-[var(--text-heading)]
            prose-code:text-[var(--accent-text)] prose-code:bg-[var(--accent-bg)] prose-code:px-1 prose-code:rounded
            prose-blockquote:border-[var(--accent-text)] prose-blockquote:text-[var(--text-muted)]
          ">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border-card)]">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-xs text-[var(--text-faint)]">
            Mastery: {Math.round(card.mastery * 100)}%
          </span>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
