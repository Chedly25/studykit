/**
 * Fiche d'arrêt editor — decision viewer on top (scrollable),
 * 5 labeled textareas for Faits / Procédure / Moyens / Question de droit / Solution et portée.
 */
import { useState } from 'react'
import { Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { FicheTask } from '../../ai/coaching/types'
import type { FicheDraft } from '../../hooks/useFicheArretCoach'

interface Props {
  task: FicheTask
  draft: FicheDraft
  onChange: (partial: Partial<FicheDraft>) => void
  onSubmit: () => void
  onCancel?: () => void
  busy?: boolean
  error?: string | null
}

const HINTS = {
  faits: 'Faits matériels uniquement (pas la procédure, pas le droit). Chronologiques, reformulés.',
  procedure: '1ère instance → appel → cassation. Juridictions nommées, motifs des décisions successives.',
  moyens: 'Reformule le moyen du pourvoi en termes juridiques — pas de citation littérale. Précise qui le soulève.',
  questionDeDroit: 'Abstraite, interrogative, dépouillée des circonstances particulières. Vise la règle.',
  solutionEtPortee: 'Dispositif (cassation/rejet + fondement) ET portée (principe, confirmation, innovation, revirement).',
} as const

export function FicheArretEditor({ task, draft, onChange, onSubmit, onCancel, busy, error }: Props) {
  const canSubmit = !busy && (
    draft.faits.trim() || draft.procedure.trim() || draft.moyens.trim() ||
    draft.questionDeDroit.trim() || draft.solutionEtPortee.trim()
  )

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 p-4">
      <DecisionViewer task={task} />

      <Field
        label="Faits"
        hint={HINTS.faits}
        value={draft.faits}
        onChange={v => onChange({ faits: v })}
        disabled={busy}
      />
      <Field
        label="Procédure"
        hint={HINTS.procedure}
        value={draft.procedure}
        onChange={v => onChange({ procedure: v })}
        disabled={busy}
      />
      <Field
        label="Moyens du pourvoi"
        hint={HINTS.moyens}
        value={draft.moyens}
        onChange={v => onChange({ moyens: v })}
        disabled={busy}
      />
      <Field
        label="Question de droit"
        hint={HINTS.questionDeDroit}
        value={draft.questionDeDroit}
        onChange={v => onChange({ questionDeDroit: v })}
        disabled={busy}
        rows={3}
      />
      <Field
        label="Solution et portée"
        hint={HINTS.solutionEtPortee}
        value={draft.solutionEtPortee}
        onChange={v => onChange({ solutionEtPortee: v })}
        disabled={busy}
      />

      {error && (
        <div className="glass-card p-3 text-sm text-rose-600 dark:text-rose-400 border border-rose-500/30">
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
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {busy ? 'Correction en cours…' : 'Soumettre pour correction'}
        </button>
      </div>
    </div>
  )
}

function DecisionViewer({ task }: { task: FicheTask }) {
  const [expanded, setExpanded] = useState(false)
  const d = task.decision
  const text = d.text || '(Texte de la décision indisponible.)'
  const isLong = text.length > 1200

  return (
    <div className="glass-card overflow-hidden sticky top-0 z-10 bg-[var(--bg-card)]">
      <div className="p-4 space-y-2 border-b border-[var(--border-card)]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] font-semibold">
            {d.chamber}
          </span>
          {d.breadcrumb && (
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              {d.breadcrumb}
            </span>
          )}
          {d.reference && (
            <span className="text-[10px] text-[var(--text-muted)] font-mono">{d.reference}</span>
          )}
        </div>
      </div>
      <div className={`p-4 text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap ${isLong && !expanded ? 'max-h-64 overflow-hidden relative' : 'max-h-[60vh] overflow-y-auto'}`}>
        {text}
        {isLong && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--bg-card)] to-transparent pointer-events-none" />
        )}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-center gap-1 px-4 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] border-t border-[var(--border-card)]"
        >
          {expanded ? <><ChevronUp className="w-3 h-3" /> Réduire</> : <><ChevronDown className="w-3 h-3" /> Voir tout</>}
        </button>
      )}
    </div>
  )
}

interface FieldProps {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  rows?: number
}

function Field({ label, hint, value, onChange, disabled, rows = 4 }: FieldProps) {
  return (
    <div className="glass-card p-4 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-semibold text-[var(--text-heading)]">{label}</label>
        <span className="text-xs text-[var(--text-muted)] text-right max-w-md">{hint}</span>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        placeholder={`Rédigez ${label.toLowerCase()}…`}
        className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-text)] focus:outline-none resize-y disabled:opacity-60"
      />
    </div>
  )
}
