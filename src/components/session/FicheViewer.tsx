/**
 * Full-page/modal markdown renderer for a single concept card fiche.
 * Renders card.content (rich markdown) or falls back to legacy keyPoints + example.
 */
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  // Build display content: prefer rich markdown, fall back to legacy
  let displayContent: string
  let hasStructuredSections = false
  if (card.content) {
    displayContent = card.content
    hasStructuredSections = /^## /m.test(card.content)
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
    hasStructuredSections = true
  }

  // Split into sections for colored rendering
  const sections = hasStructuredSections ? splitSections(displayContent) : null

  function splitSections(content: string): Array<{ heading: string; body: string }> | null {
    const result: Array<{ heading: string; body: string }> = []
    const parts = content.split(/^## /m)
    for (const part of parts) {
      if (!part.trim()) continue
      const nlIdx = part.indexOf('\n')
      if (nlIdx === -1) { result.push({ heading: part.trim(), body: '' }); continue }
      result.push({ heading: part.slice(0, nlIdx).trim(), body: part.slice(nlIdx + 1).trim() })
    }
    return result.length > 0 ? result : null
  }

  const FICHE_SECTION_STYLES: Record<string, { border: string; bg: string }> = {
    'definition':      { border: 'border-blue-400',    bg: 'bg-blue-50/60 dark:bg-blue-500/5' },
    'définition':      { border: 'border-blue-400',    bg: 'bg-blue-50/60 dark:bg-blue-500/5' },
    'key points':      { border: 'border-indigo-400',  bg: 'bg-indigo-50/60 dark:bg-indigo-500/5' },
    'points clés':     { border: 'border-indigo-400',  bg: 'bg-indigo-50/60 dark:bg-indigo-500/5' },
    'how it works':    { border: 'border-cyan-400',    bg: 'bg-cyan-50/60 dark:bg-cyan-500/5' },
    'fonctionnement':  { border: 'border-cyan-400',    bg: 'bg-cyan-50/60 dark:bg-cyan-500/5' },
    'example':         { border: 'border-emerald-400', bg: 'bg-emerald-50/60 dark:bg-emerald-500/5' },
    'exemple':         { border: 'border-emerald-400', bg: 'bg-emerald-50/60 dark:bg-emerald-500/5' },
    'important rules': { border: 'border-purple-400',  bg: 'bg-purple-50/60 dark:bg-purple-500/5' },
    'règles':          { border: 'border-purple-400',  bg: 'bg-purple-50/60 dark:bg-purple-500/5' },
    'common mistakes': { border: 'border-amber-400',   bg: 'bg-amber-50/60 dark:bg-amber-500/5' },
    'common pitfalls': { border: 'border-amber-400',   bg: 'bg-amber-50/60 dark:bg-amber-500/5' },
    'erreurs':         { border: 'border-amber-400',   bg: 'bg-amber-50/60 dark:bg-amber-500/5' },
    'pièges':          { border: 'border-amber-400',   bg: 'bg-amber-50/60 dark:bg-amber-500/5' },
    'comparison':      { border: 'border-pink-400',    bg: 'bg-pink-50/60 dark:bg-pink-500/5' },
    'comparaison':     { border: 'border-pink-400',    bg: 'bg-pink-50/60 dark:bg-pink-500/5' },
    'summary':         { border: 'border-slate-400',   bg: 'bg-slate-50/60 dark:bg-slate-500/5' },
    'résumé':          { border: 'border-slate-400',   bg: 'bg-slate-50/60 dark:bg-slate-500/5' },
    'theorem':         { border: 'border-purple-400',  bg: 'bg-purple-50/60 dark:bg-purple-500/5' },
    'théorème':        { border: 'border-purple-400',  bg: 'bg-purple-50/60 dark:bg-purple-500/5' },
    'properties':      { border: 'border-indigo-400',  bg: 'bg-indigo-50/60 dark:bg-indigo-500/5' },
    'propriétés':      { border: 'border-indigo-400',  bg: 'bg-indigo-50/60 dark:bg-indigo-500/5' },
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
                <HelpCircle className="w-3.5 h-3.5" /> {t('cards.quizMe')}
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
          {sections ? (
            <div className="space-y-4">
              {sections.map((section, i) => {
                const lower = section.heading.toLowerCase()
                const isSource = lower.startsWith('source')
                const isTitle = !section.body && i === 0

                if (isTitle) return null
                if (isSource) {
                  return <p key={i} className="text-xs text-[var(--text-faint)] italic">{section.body}</p>
                }

                const styleKey = Object.keys(FICHE_SECTION_STYLES).find(k => lower.startsWith(k))
                const style = styleKey ? FICHE_SECTION_STYLES[styleKey] : null

                return (
                  <div key={i} className={`rounded-xl p-4 ${style ? `border-l-4 ${style.border} ${style.bg}` : 'bg-[var(--bg-input)]/50'}`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">{section.heading}</h3>
                    <div className="prose prose-sm max-w-none text-[var(--text-body)]
                      prose-p:text-sm prose-p:leading-relaxed prose-p:my-1.5
                      prose-ul:my-2 prose-li:text-sm prose-li:my-0.5
                      prose-strong:text-[var(--text-heading)]
                      prose-blockquote:border-[var(--text-faint)] prose-blockquote:text-[var(--text-body)] prose-blockquote:not-italic prose-blockquote:font-medium
                      prose-code:text-[var(--accent-text)] prose-code:bg-[var(--accent-bg)] prose-code:px-1 prose-code:rounded prose-code:text-xs
                    ">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {section.body}
                      </ReactMarkdown>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
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
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {displayContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border-card)]">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" /> {t('common.previous')}
          </button>
          <span className="text-xs text-[var(--text-faint)]">
            {t('fiche.mastery')} {Math.round(card.mastery * 100)}%
          </span>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            {t('common.next')} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
