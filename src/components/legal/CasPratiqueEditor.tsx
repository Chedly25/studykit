/**
 * Cas pratique editor — scenario markdown on top, single prose textarea below.
 * Word counter, optional soft timer, submit with <800-word warning.
 */
import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Loader2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import type { CasPratiqueTask } from '../../ai/coaching/types'
import type { CasPratiqueDraft } from '../../hooks/useCasPratiqueCoach'
import { CoachTimer } from './CoachTimer'

interface Props {
  task: CasPratiqueTask
  draft: CasPratiqueDraft
  onChange: (partial: Partial<CasPratiqueDraft>) => void
  onSubmit: () => void
  onCancel?: () => void
  busy?: boolean
  error?: string | null
}

const WORD_WARN_THRESHOLD = 800

export function CasPratiqueEditor({ task, draft, onChange, onSubmit, onCancel, busy, error }: Props) {
  const [scenarioExpanded, setScenarioExpanded] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)

  const wordCount = useMemo(() => {
    return draft.answer.trim() ? draft.answer.trim().split(/\s+/).length : 0
  }, [draft.answer])

  const canSubmit = !busy && draft.answer.trim().length > 0

  const handleSubmitClick = () => {
    if (wordCount < WORD_WARN_THRESHOLD) {
      setShowConfirm(true)
    } else {
      onSubmit()
    }
  }

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 p-4">
      {/* Scenario */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => setScenarioExpanded(e => !e)}
          className="w-full flex items-center justify-between gap-2 p-4 border-b border-[var(--border-card)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] font-semibold">
              {task.specialtyLabel}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              {task.duration} min · {task.legalIssues.length} problème{task.legalIssues.length > 1 ? 's' : ''} à identifier
            </span>
          </div>
          <span className="text-[var(--text-muted)]">
            {scenarioExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>
        {scenarioExpanded && (
          <div className="p-4 text-sm text-[var(--text-primary)] leading-relaxed max-h-[50vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.scenario}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Optional timer (soft expiry — matches other coaches) */}
      <CoachTimer sessionKey={`cas-pratique-${task.generatedAt}`} defaultSeconds={task.duration * 60} />

      {/* Writing area */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-2 border-b border-[var(--border-card)] flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--text-heading)]">
            Ta consultation
          </span>
          <span className={`text-xs tabular-nums ${wordCount < WORD_WARN_THRESHOLD ? 'text-[var(--text-muted)]' : 'text-[var(--text-body)]'}`}>
            {wordCount.toLocaleString('fr')} mots
          </span>
        </div>
        <textarea
          value={draft.answer}
          onChange={e => onChange({ answer: e.target.value })}
          disabled={busy}
          rows={20}
          placeholder="Sur le fondement de l'article… il convient de… En conséquence, je recommande à mon client de…"
          className="w-full bg-transparent px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-y min-h-[400px] leading-relaxed"
        />
      </div>

      {error && (
        <div className="glass-card p-3 text-sm text-[var(--color-error)] border border-[var(--color-error-border)]">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 justify-end">
        {busy && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
          >
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={!canSubmit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {busy ? 'Correction en cours…' : 'Soumettre pour correction'}
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-card p-5 max-w-sm w-full mx-4 space-y-3">
            <div className="flex items-center gap-2 text-[var(--color-warning)]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-[var(--text-heading)]">
                Ta consultation est courte
              </h3>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Tu n'as écrit que {wordCount} mots. Une consultation CRFPA fait plutôt 1 500 à 2 500 mots. Tu peux quand même soumettre, mais la correction risque d'être sévère.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowConfirm(false); onSubmit() }}
                className="flex-1 px-4 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90"
              >
                Soumettre quand même
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              >
                Continuer à écrire
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
