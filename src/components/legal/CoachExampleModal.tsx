/**
 * Modal that renders a curated graded example for a coach.
 * Layout: title + overall score → submission (markdown) → axis-by-axis rubric
 * with grader comments. The point is recognition-over-recall — let the user
 * see one excellent answer before facing a blank editor.
 */
import { useEffect } from 'react'
import { X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CoachExample } from '../../data/coachExamples'

interface CoachExampleModalProps {
  example: CoachExample
  onClose: () => void
}

export function CoachExampleModal({ example, onClose }: CoachExampleModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const overallPct = example.overallMax > 0
    ? Math.round((example.overallScore / example.overallMax) * 100)
    : 0

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="example-title"
    >
      <div
        className="relative max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] shadow-xl animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="sticky top-3 ml-auto mr-3 mt-3 z-10 flex p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-hover)] transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pb-6 -mt-6">
          <div className="text-xs uppercase tracking-wider font-semibold text-[var(--accent-text)] mb-1">
            Exemple corrigé
          </div>
          <h2
            id="example-title"
            className="text-xl font-bold text-[var(--text-heading)] leading-snug"
          >
            {example.title}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{example.hook}</p>

          {/* Overall score banner */}
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-[var(--accent-text)]">
              {example.overallScore}
            </span>
            <span className="text-sm text-[var(--text-muted)]">/ {example.overallMax}</span>
            <span className="text-xs text-[var(--text-faint)] ml-2">({overallPct} %)</span>
          </div>
          {example.overallComment && (
            <p className="text-sm text-[var(--text-body)] mt-2 leading-relaxed italic">
              « {example.overallComment} »
            </p>
          )}

          {/* Optional context */}
          {example.context && (
            <section className="mt-6">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">
                Contexte
              </h3>
              <div className="prose prose-sm max-w-none text-[var(--text-body)] leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{example.context}</ReactMarkdown>
              </div>
            </section>
          )}

          {/* Submission */}
          <section className="mt-6">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">
              La copie
            </h3>
            <div className="rounded-xl border border-[var(--border-card)] bg-[var(--bg-input)] p-4">
              <div className="prose prose-sm max-w-none text-[var(--text-body)] leading-relaxed prose-headings:text-[var(--text-heading)] prose-headings:font-semibold prose-strong:text-[var(--text-heading)]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{example.submission}</ReactMarkdown>
              </div>
            </div>
          </section>

          {/* Per-axis grading */}
          <section className="mt-6">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2">
              La correction, axe par axe
            </h3>
            <ul className="space-y-3">
              {example.axes.map((axis, i) => {
                const axisPct = axis.max > 0 ? Math.round((axis.score / axis.max) * 100) : 0
                return (
                  <li key={i} className="rounded-lg border border-[var(--border-card)] p-3">
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="text-sm font-semibold text-[var(--text-heading)]">
                        {axis.name}
                      </span>
                      <span className="text-xs tabular-nums text-[var(--text-muted)] shrink-0">
                        {axis.score} / {axis.max}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-[var(--bg-input)] overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full bg-[var(--accent-text)]"
                        style={{ width: `${axisPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-[var(--text-body)] leading-relaxed">
                      {axis.comment}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
