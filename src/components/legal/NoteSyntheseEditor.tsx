/**
 * Note de synthèse editor — split-pane: dossier viewer (left) + writing area (right).
 * Responsive: stacked on mobile (dossier collapsible at top, writing area below).
 */
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { DossierPanel, type DossierDoc } from '../practice/legal/DossierPanel'
import { CoachTimer } from './CoachTimer'
import type { NoteSyntheseTask } from '../../ai/coaching/types'

interface Props {
  task: NoteSyntheseTask
  draftText: string
  onChange: (text: string) => void
  onSubmit: () => void
  onCancel?: () => void
  busy?: boolean
  error?: string | null
}

export function NoteSyntheseEditor({ task, draftText, onChange, onSubmit, onCancel, busy, error }: Props) {
  const [dossierOpen, setDossierOpen] = useState(false)

  const docs: DossierDoc[] = useMemo(
    () => task.documents.map(d => ({
      docNumber: d.docNumber,
      title: d.title,
      type: d.type,
      content: d.content,
      sourceUrl: d.sourceUrl,
    })),
    [task.documents],
  )

  const wordCount = draftText.trim() ? draftText.trim().split(/\s+/).length : 0
  const canSubmit = !busy && wordCount > 0

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      {/* Dossier panel — desktop: left column, mobile: collapsible */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col border-r border-[var(--border-card)] min-h-0">
        <DossierPanel documents={docs} />
      </div>

      {/* Mobile dossier toggle */}
      <div className="lg:hidden border-b border-[var(--border-card)]">
        <button
          onClick={() => setDossierOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)]"
        >
          <span className="text-sm font-semibold text-[var(--text-heading)]">
            Dossier ({task.documents.length} documents)
          </span>
          {dossierOpen
            ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
            : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          }
        </button>
        {dossierOpen && (
          <div className="h-[50vh] border-t border-[var(--border-card)]">
            <DossierPanel documents={docs} />
          </div>
        )}
      </div>

      {/* Writing area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Theme + timer bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-card)] bg-[var(--bg-card)] shrink-0">
          <div className="min-w-0 flex-1 mr-3">
            <h3 className="text-sm font-semibold text-[var(--text-heading)] truncate">
              {task.dossierTitle}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] truncate">
              {task.problematique}
            </p>
          </div>
          <CoachTimer sessionKey={`synthese-${task.practiceExamSessionId}`} defaultSeconds={5 * 3600} />
        </div>

        {/* Textarea */}
        <div className="flex-1 min-h-0 p-4">
          <textarea
            value={draftText}
            onChange={e => onChange(e.target.value)}
            disabled={busy}
            placeholder="Rédige ta note de synthèse ici. Cite chaque document avec (Doc. N). Introduction, développement en I/A, I/B, II/A, II/B, pas de conclusion."
            className="w-full h-full resize-none rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] text-[var(--text-primary)] text-sm leading-relaxed p-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent-text)] disabled:opacity-60"
          />
        </div>

        {/* Footer: word count + submit */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-card)] shrink-0">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-mono ${
              wordCount >= 2200
                ? 'text-[var(--color-success)] '
                : wordCount >= 1200
                  ? 'text-[var(--color-warning)] '
                  : 'text-[var(--text-muted)]'
            }`}>
              {wordCount} mots
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              objectif ~2400
            </span>
          </div>

          <div className="flex items-center gap-2">
            {error && (
              <span className="text-xs text-[var(--color-error)] max-w-xs truncate">
                {error}
              </span>
            )}

            {busy && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-card)]"
              >
                Annuler
              </button>
            )}

            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy ? 'Correction en cours...' : 'Soumettre'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
