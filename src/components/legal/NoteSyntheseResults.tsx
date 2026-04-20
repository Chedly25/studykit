/**
 * Note de synthèse grading results: 8-axis rubric /20 + document coverage + collapsible sections.
 */
import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, FileText, CheckCircle2, XCircle } from 'lucide-react'
import { GradedRubric, type RubricCriterion } from './GradedRubric'
import { DossierPanel, type DossierDoc } from '../practice/legal/DossierPanel'
import type { NoteSyntheseGrading, NoteSyntheseSubmission, NoteSyntheseTask } from '../../ai/coaching/types'

interface Props {
  task: NoteSyntheseTask
  submission: NoteSyntheseSubmission
  grading: NoteSyntheseGrading
  onRetry: () => void
  onNewDossier: () => void
}

export function NoteSyntheseResults({ task, submission, grading, onRetry, onNewDossier }: Props) {
  const criteria: RubricCriterion[] = grading.axes.map(a => ({
    label: a.label,
    score: a.score,
    max: a.max,
    feedback: a.feedback,
  }))

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 p-4">
      {/* Theme recap */}
      <div className="glass-card p-3">
        <div className="text-xs uppercase tracking-wider text-[var(--accent-text)] font-semibold mb-1">
          Note de synthèse
        </div>
        <p className="text-sm font-medium text-[var(--text-heading)]">{task.dossierTitle}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{task.documents.length} documents</p>
      </div>

      <GradedRubric
        criteria={criteria}
        overall={{
          score: grading.overall.score,
          max: 20,
          topMistake: grading.overall.topMistake,
          strength: grading.overall.strength,
        }}
      />

      <DocumentCoverage
        documents={task.documents}
        cited={grading.documentsCited}
        missed={grading.documentsMissed}
      />

      <CollapsibleText title="Ma copie" content={submission.text} />
      <CollapsibleText title="Synthèse modèle" content={task.modelSynthesis} />
      <CollapsibleDossier task={task} />

      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-card)]"
        >
          <RefreshCw className="w-4 h-4" />
          Recommencer ce dossier
        </button>
        <button
          type="button"
          onClick={onNewDossier}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90"
        >
          Nouveau dossier
        </button>
      </div>
    </div>
  )
}

// ─── Document coverage card ──────────────────────────────────────

function DocumentCoverage({
  documents,
  cited,
  missed,
}: {
  documents: NoteSyntheseTask['documents']
  cited: number[]
  missed: number[]
}) {
  const citedSet = new Set(cited)
  const missedSet = new Set(missed)

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-3">
        Couverture documentaire
      </h3>
      <div className="flex flex-wrap gap-2">
        {documents.map(d => {
          const isCited = citedSet.has(d.docNumber)
          const isMissed = missedSet.has(d.docNumber)
          return (
            <div
              key={d.docNumber}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                isCited
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : isMissed
                    ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
                    : 'border-[var(--border-card)] text-[var(--text-muted)]'
              }`}
              title={d.title}
            >
              {isCited
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : isMissed
                  ? <XCircle className="w-3.5 h-3.5" />
                  : null
              }
              Doc {d.docNumber}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          {cited.length} cité{cited.length > 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <XCircle className="w-3 h-3 text-rose-500" />
          {missed.length} manquant{missed.length > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

// ─── Collapsible text section ────────────────────────────────────

function CollapsibleText({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)]"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-heading)]">
          <FileText className="w-4 h-4" />
          {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>
      {open && (
        <div className="border-t border-[var(--border-card)] p-4 text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
          {content || '(vide)'}
        </div>
      )}
    </div>
  )
}

// ─── Collapsible dossier viewer ──────────────────────────────────

function CollapsibleDossier({ task }: { task: NoteSyntheseTask }) {
  const [open, setOpen] = useState(false)

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

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)]"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-heading)]">
          <FileText className="w-4 h-4" />
          Dossier ({task.documents.length} documents)
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>
      {open && (
        <div className="border-t border-[var(--border-card)] h-[60vh]">
          <DossierPanel documents={docs} />
        </div>
      )}
    </div>
  )
}
