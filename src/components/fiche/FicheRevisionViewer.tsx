/**
 * Full-page revision fiche viewer — renders a topic-level revision sheet
 * with KaTeX math, color-coded sections, and print-friendly layout.
 */
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Printer, RefreshCw, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { db } from '../../db'
import { useExamProfile } from '../../hooks/useExamProfile'
import { useBackgroundJobs } from '../BackgroundJobsProvider'

// Section color mapping (same system as ConceptCardBlock/FicheViewer)
function sectionColorClass(heading: string): string {
  const h = heading.toLowerCase()
  if (h.includes('définition') || h.includes('definition')) return 'border-l-4 border-[var(--color-info)] bg-[var(--color-info-bg)]'
  if (h.includes('théorème') || h.includes('theorem') || h.includes('clés') || h.includes('key')) return 'border-l-4 border-[var(--color-tag-flashcard)] bg-[var(--color-tag-flashcard-bg)]'
  if (h.includes('démonstration') || h.includes('proof')) return 'border-l-4 border-[var(--color-tag-flashcard)] bg-[var(--color-tag-flashcard-bg)]'
  if (h.includes('méthode') || h.includes('method')) return 'border-l-4 border-[var(--color-info-border)] bg-[var(--color-info-bg)]'
  if (h.includes('erreur') || h.includes('mistake') || h.includes('piège')) return 'border-l-4 border-[var(--color-warning)] bg-[var(--color-warning-bg)]'
  if (h.includes('exercice') || h.includes('exercise') || h.includes('exemple')) return 'border-l-4 border-[var(--color-success)] bg-[var(--color-success-bg)]'
  return ''
}

export default function FicheRevisionPage() {
  const { topicId } = useParams<{ topicId: string }>()
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { enqueue } = useBackgroundJobs()

  const fiche = useLiveQuery(
    () => profileId && topicId
      ? db.revisionFiches.where('[examProfileId+topicId]').equals([profileId, topicId]).first()
      : undefined,
    [profileId, topicId],
  )

  const topic = useLiveQuery(
    () => topicId ? db.topics.get(topicId) : undefined,
    [topicId],
  )

  const subject = useLiveQuery(
    () => topic?.subjectId ? db.subjects.get(topic.subjectId) : undefined,
    [topic?.subjectId],
  )

  const handleRegenerate = async () => {
    if (!profileId || !topicId || !topic || !subject) return
    await enqueue('fiche-generation', profileId, {
      topicId,
      topicName: topic.name,
      subjectId: subject.id,
      subjectName: subject.name,
      examName: activeProfile?.name ?? 'Exam',
    }, 1)
  }

  // Split content into sections for color-coding
  const sections = useMemo(() => {
    if (!fiche?.content) return []
    const parts: Array<{ heading: string; body: string }> = []
    const lines = fiche.content.split('\n')
    let currentHeading = ''
    let currentBody: string[] = []

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentHeading || currentBody.length > 0) {
          parts.push({ heading: currentHeading, body: currentBody.join('\n') })
        }
        currentHeading = line.slice(3).trim()
        currentBody = []
      } else {
        currentBody.push(line)
      }
    }
    if (currentHeading || currentBody.length > 0) {
      parts.push({ heading: currentHeading, body: currentBody.join('\n') })
    }
    return parts
  }, [fiche?.content])

  if (!fiche) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link to={topicId ? `/topic/${topicId}` : '/dashboard'} className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] mb-4 w-fit">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </Link>
        <div className="text-center py-12">
          <p className="text-sm text-[var(--text-muted)] mb-4">
            {t('fiche.notFound')}
          </p>
          {profileId && topicId && topic && subject && (
            <button onClick={handleRegenerate} className="btn-primary px-6 py-2.5 text-sm">
              {t('fiche.generate')}
            </button>
          )}
        </div>
      </div>
    )
  }

  const updatedAgo = (() => {
    const ms = Date.now() - new Date(fiche.updatedAt).getTime()
    const days = Math.floor(ms / 86400000)
    if (days === 0) return t('fiche.today')
    if (days === 1) return t('fiche.yesterday')
    return t('fiche.daysAgo', '{{count}} days ago', { count: days })
  })()

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 animate-fade-in">
      {/* Header — hidden on print */}
      <div className="print:hidden">
        <Link to={topicId ? `/topic/${topicId}` : '/dashboard'} className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] mb-4 w-fit">
          <ArrowLeft className="w-4 h-4" /> {subject?.name ?? t('common.back')}
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-heading)]">{fiche.title}</h1>
            <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mt-1">
              <Clock className="w-3 h-3" />
              {t('fiche.lastUpdated', 'Updated {{when}}', { when: updatedAgo })}
              {fiche.version > 1 && <span> · v{fiche.version}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRegenerate}
              disabled={!topic || !subject}
              className="btn-ghost px-3 py-2 text-xs flex items-center gap-1.5 disabled:opacity-40"
              title={t('fiche.regenerate')}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => window.print()}
              className="btn-ghost px-3 py-2 text-xs flex items-center gap-1.5"
              title={t('fiche.print')}
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Fiche content — color-coded sections */}
      <div className="space-y-4">
        {sections.map((section, i) => {
          if (!section.heading && i === 0) {
            // Title / intro section (before first ## heading)
            return (
              <div key={i} className="prose prose-sm max-w-none prose-headings:text-[var(--text-heading)] prose-p:text-[var(--text-body)] prose-strong:text-[var(--text-heading)]">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {section.body}
                </ReactMarkdown>
              </div>
            )
          }

          const colorClass = sectionColorClass(section.heading)

          return (
            <div key={i} className={`glass-card p-4 ${colorClass}`}>
              <h2 className="text-sm font-bold text-[var(--text-heading)] mb-2">{section.heading}</h2>
              <div className="prose prose-sm max-w-none prose-headings:text-[var(--text-heading)] prose-p:text-[var(--text-body)] prose-strong:text-[var(--text-heading)] prose-li:text-[var(--text-body)] prose-code:text-[var(--accent-text)] prose-code:bg-[var(--accent-bg)] prose-code:px-1 prose-code:rounded prose-code:text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {section.body}
                </ReactMarkdown>
              </div>
            </div>
          )
        })}
      </div>

      {/* Print title (visible only on print) */}
      <div className="hidden print:block print:mb-4">
        <h1 className="text-xl font-bold">{fiche.title}</h1>
        <p className="text-xs text-gray-500">{subject?.name} · {t('fiche.lastUpdated', 'Updated {{when}}', { when: updatedAgo })}</p>
      </div>
    </div>
  )
}
