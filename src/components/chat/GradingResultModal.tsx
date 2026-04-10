/**
 * Grading Result Modal — shows the AI's correction of a handwritten solution.
 * Step-by-step feedback with color coding (correct/partial/error).
 */
import { X, Check, AlertTriangle, XCircle, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import type { GradingResult } from '../../hooks/usePhotoCapture'

interface Props {
  result: GradingResult | null
  imageUrl: string | null
  isLoading: boolean
  onClose: () => void
}

const STATUS_CONFIG = {
  correct: {
    icon: Check,
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/40',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  partial: {
    icon: AlertTriangle,
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/40',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  error: {
    icon: XCircle,
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/40',
    textClass: 'text-red-600 dark:text-red-400',
  },
}

export default function GradingResultModal({ result, imageUrl, isLoading, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-card max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-[var(--border-card)] bg-[var(--bg-card)] z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-heading)]">
              Correction de ta copie
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Preview thumbnail */}
          {imageUrl && (
            <div className="flex justify-center">
              <img
                src={imageUrl}
                alt="Ta copie"
                className="max-h-48 rounded-lg border border-[var(--border-card)] shadow-sm"
              />
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--text-muted)]">
                Le prof analyse ta copie...
              </p>
              <p className="text-xs text-[var(--text-faint)]">
                Transcription, vérification du raisonnement, notation
              </p>
            </div>
          )}

          {result && !isLoading && (
            <>
              {/* Score */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-[var(--accent)]/10 to-[var(--accent)]/5 border border-[var(--accent)]/20">
                <div>
                  <div className="text-xs text-[var(--text-muted)] mb-1">Note estimée</div>
                  <div className="text-3xl font-bold text-[var(--text-heading)]">
                    {result.overallScore}<span className="text-lg text-[var(--text-muted)]">/{result.maxScore}</span>
                  </div>
                </div>
                <div className="text-right text-xs text-[var(--text-muted)] max-w-[60%]">
                  <div className="font-medium text-[var(--text-body)] mb-0.5">Sujet</div>
                  <div>{result.problemStatement}</div>
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-[var(--bg-input)]/50 border border-[var(--border-card)]">
                <div className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">
                  Bilan
                </div>
                <p className="text-sm text-[var(--text-body)] leading-relaxed">
                  {result.summary}
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                  Analyse ligne par ligne
                </div>
                {result.steps.map((step, i) => {
                  const config = STATUS_CONFIG[step.status]
                  const Icon = config.icon
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${config.bgClass} ${config.borderClass}`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.textClass}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                            Ligne {step.line}
                          </div>
                          <div className="text-sm text-[var(--text-body)] prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                            >
                              {step.content}
                            </ReactMarkdown>
                          </div>
                          {step.feedback && (
                            <div className={`text-xs mt-2 ${config.textClass}`}>
                              {step.feedback}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Suggestions */}
              {result.suggestions.length > 0 && (
                <div className="p-4 rounded-xl bg-[var(--bg-input)]/50 border border-[var(--border-card)]">
                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">
                    Pour progresser
                  </div>
                  <ul className="space-y-1.5">
                    {result.suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-[var(--text-body)] flex items-start gap-2">
                        <span className="text-[var(--accent)] shrink-0">→</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
