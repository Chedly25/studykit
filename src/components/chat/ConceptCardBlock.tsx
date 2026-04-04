import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Check, HelpCircle } from 'lucide-react'
import { SaveToDeckDropdown } from './SaveToDeckDropdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { db } from '../../db'
import { MathText } from '../MathText'
import type { ConceptCard } from '../../db/schema'

interface ConceptCardBlockProps {
  cardId: string
  onQuizMe?: (topic: string) => void
}

// ─── Section color mapping ─────────────────────────────────

const SECTION_STYLES: Record<string, { border: string; bg: string }> = {
  // Core — works for any subject
  'definition':      { border: 'border-blue-400 dark:border-blue-500',      bg: 'bg-blue-50/60 dark:bg-blue-500/5' },
  'définition':      { border: 'border-blue-400 dark:border-blue-500',      bg: 'bg-blue-50/60 dark:bg-blue-500/5' },
  'key points':      { border: 'border-indigo-400 dark:border-indigo-500',  bg: 'bg-indigo-50/60 dark:bg-indigo-500/5' },
  'points clés':     { border: 'border-indigo-400 dark:border-indigo-500',  bg: 'bg-indigo-50/60 dark:bg-indigo-500/5' },
  'how it works':    { border: 'border-cyan-400 dark:border-cyan-500',      bg: 'bg-cyan-50/60 dark:bg-cyan-500/5' },
  'fonctionnement':  { border: 'border-cyan-400 dark:border-cyan-500',      bg: 'bg-cyan-50/60 dark:bg-cyan-500/5' },
  'example':         { border: 'border-emerald-400 dark:border-emerald-500', bg: 'bg-emerald-50/60 dark:bg-emerald-500/5' },
  'exemple':         { border: 'border-emerald-400 dark:border-emerald-500', bg: 'bg-emerald-50/60 dark:bg-emerald-500/5' },
  'important rules': { border: 'border-purple-400 dark:border-purple-500',  bg: 'bg-purple-50/60 dark:bg-purple-500/5' },
  'règles':          { border: 'border-purple-400 dark:border-purple-500',  bg: 'bg-purple-50/60 dark:bg-purple-500/5' },
  'common mistakes': { border: 'border-amber-400 dark:border-amber-500',    bg: 'bg-amber-50/60 dark:bg-amber-500/5' },
  'common pitfalls': { border: 'border-amber-400 dark:border-amber-500',    bg: 'bg-amber-50/60 dark:bg-amber-500/5' },
  'erreurs':         { border: 'border-amber-400 dark:border-amber-500',    bg: 'bg-amber-50/60 dark:bg-amber-500/5' },
  'pièges':          { border: 'border-amber-400 dark:border-amber-500',    bg: 'bg-amber-50/60 dark:bg-amber-500/5' },
  'comparison':      { border: 'border-pink-400 dark:border-pink-500',      bg: 'bg-pink-50/60 dark:bg-pink-500/5' },
  'comparaison':     { border: 'border-pink-400 dark:border-pink-500',      bg: 'bg-pink-50/60 dark:bg-pink-500/5' },
  'summary':         { border: 'border-slate-400 dark:border-slate-500',    bg: 'bg-slate-50/60 dark:bg-slate-500/5' },
  'résumé':          { border: 'border-slate-400 dark:border-slate-500',    bg: 'bg-slate-50/60 dark:bg-slate-500/5' },
  // Domain-specific (still useful when they appear)
  'theorem':         { border: 'border-purple-400 dark:border-purple-500',  bg: 'bg-purple-50/60 dark:bg-purple-500/5' },
  'théorème':        { border: 'border-purple-400 dark:border-purple-500',  bg: 'bg-purple-50/60 dark:bg-purple-500/5' },
  'properties':      { border: 'border-indigo-400 dark:border-indigo-500',  bg: 'bg-indigo-50/60 dark:bg-indigo-500/5' },
  'propriétés':      { border: 'border-indigo-400 dark:border-indigo-500',  bg: 'bg-indigo-50/60 dark:bg-indigo-500/5' },
  'source':          { border: 'border-[var(--border-card)]',               bg: '' },
}

function getSectionStyle(heading: string) {
  const lower = heading.toLowerCase()
  for (const [key, style] of Object.entries(SECTION_STYLES)) {
    if (lower.startsWith(key)) return style
  }
  return null
}

function splitIntoSections(content: string): Array<{ heading: string; body: string }> {
  const sections: Array<{ heading: string; body: string }> = []
  const parts = content.split(/^## /m)
  for (const part of parts) {
    if (!part.trim()) continue
    const newlineIdx = part.indexOf('\n')
    if (newlineIdx === -1) {
      sections.push({ heading: part.trim(), body: '' })
    } else {
      sections.push({ heading: part.slice(0, newlineIdx).trim(), body: part.slice(newlineIdx + 1).trim() })
    }
  }
  return sections
}

// ─── Section renderer ──────────────────────────────────────

function FicheSection({ heading, body }: { heading: string; body: string }) {
  const style = getSectionStyle(heading)
  const isSource = heading.toLowerCase().startsWith('source')

  if (isSource) {
    return (
      <p className="text-[10px] text-[var(--text-faint)] mt-2 italic">{body}</p>
    )
  }

  return (
    <div className={`rounded-lg p-3 mb-2.5 ${style ? `border-l-4 ${style.border} ${style.bg}` : 'bg-[var(--bg-input)]/50'}`}>
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{heading}</h3>
      <div className="text-sm text-[var(--text-body)] leading-relaxed prose-sm max-w-none
        prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5
        prose-strong:text-[var(--text-heading)]
        prose-blockquote:border-[var(--text-faint)] prose-blockquote:text-[var(--text-body)] prose-blockquote:not-italic prose-blockquote:font-medium
        prose-code:text-[var(--accent-text)] prose-code:bg-[var(--accent-bg)] prose-code:px-1 prose-code:rounded prose-code:text-xs
      ">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
          {body}
        </ReactMarkdown>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────

export function ConceptCardBlock({ cardId, onQuizMe }: ConceptCardBlockProps) {
  const { t } = useTranslation()
  const [card, setCard] = useState<ConceptCard | null>(null)
  const [mastered, setMastered] = useState(false)
  const [subjectColor, setSubjectColor] = useState<string | null>(null)

  useEffect(() => {
    db.conceptCards.get(cardId).then(c => {
      if (c) {
        setCard(c)
        setMastered(c.mastery >= 0.8)
        // Load subject color
        db.topics.get(c.topicId).then(topic => {
          if (topic) {
            db.subjects.get(topic.subjectId).then(subject => {
              if (subject) setSubjectColor(subject.color)
            })
          }
        })
      }
    })
  }, [cardId])

  const sections = useMemo(() => {
    if (!card?.content) return null
    const result = splitIntoSections(card.content)
    return result.length > 0 ? result : null
  }, [card?.content])

  if (!card) {
    return (
      <div className="my-3 glass-card p-4 animate-pulse">
        <div className="h-4 bg-[var(--bg-input)] rounded w-1/3 mb-3" />
        <div className="h-3 bg-[var(--bg-input)] rounded w-full mb-2" />
        <div className="h-3 bg-[var(--bg-input)] rounded w-2/3" />
      </div>
    )
  }

  // Legacy data
  let keyPoints: string[] = []
  let connections: string[] = []
  try { keyPoints = JSON.parse(card.keyPoints) } catch { /* empty */ }
  try { connections = JSON.parse(card.relatedCardIds) } catch { /* empty */ }

  const handleGotIt = async () => {
    setMastered(true)
    await db.conceptCards.update(cardId, { mastery: 1, updatedAt: new Date().toISOString() })
  }

  const accentColor = subjectColor || 'var(--accent-text)'

  return (
    <div className={`my-3 glass-card overflow-hidden transition-all ${mastered ? 'ring-1 ring-green-500/30' : ''}`}>
      {/* Subject-colored accent bar */}
      <div className="h-1.5" style={{ backgroundColor: accentColor }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-2 mb-3">
          <div className="p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: `${accentColor}15` }}>
            <BookOpen className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-[var(--text-heading)]">{card.title}</h4>
            {card.sourceReference && (
              <span className="text-[10px] text-[var(--text-faint)]">{card.sourceReference}</span>
            )}
          </div>
          {mastered && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
        </div>

        {/* Rich content (new cards with content field) */}
        {sections ? (
          <div className="mb-3">
            {sections.map((section, i) => (
              <FicheSection key={i} heading={section.heading} body={section.body} />
            ))}
          </div>
        ) : (
          /* Legacy fallback: bullet points */
          <>
            <ul className="space-y-1.5 mb-3">
              {keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-body)]">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: accentColor }} />
                  <MathText>{point}</MathText>
                </li>
              ))}
            </ul>

            {card.example && (
              <div className="rounded-lg border-l-4 border-emerald-400 bg-emerald-50/60 dark:bg-emerald-500/5 px-3 py-2 mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">{t('cards.example')}</h3>
                <p className="text-xs text-[var(--text-body)]"><MathText>{card.example}</MathText></p>
              </div>
            )}
          </>
        )}

        {/* Connections */}
        {connections.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {connections.map((conn, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)]"
              >
                {conn}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-card)]">
          {!mastered && (
            <button
              onClick={handleGotIt}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
            >
              <Check className="w-3 h-3" /> {t('cards.gotIt')}
            </button>
          )}
          {onQuizMe && (
            <button
              onClick={() => onQuizMe(card.title)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors"
            >
              <HelpCircle className="w-3 h-3" /> {t('cards.quizMe')}
            </button>
          )}
          <SaveToDeckDropdown
            examProfileId={card.examProfileId}
            front={card.title}
            back={card.content ?? (JSON.parse(card.keyPoints || '[]') as string[]).join('\n')}
            topicId={card.topicId}
          />
        </div>
      </div>
    </div>
  )
}
