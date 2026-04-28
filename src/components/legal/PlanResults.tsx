/**
 * Grading results for a plan submission: 6-axis rubric + side-by-side model plan,
 * common pitfalls callout, and revealed source articles.
 */
import { useState } from 'react'
import { AlertTriangle, BookOpen, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { GradedRubric, type RubricCriterion } from './GradedRubric'
import type { PlanGrading, PlanSubmission, PlanTask } from '../../ai/coaching/types'

interface Props {
  task: PlanTask
  submission: PlanSubmission
  grading: PlanGrading
  onRetry: () => void
  onNewQuestion: () => void
}

export function PlanResults({ task, submission, grading, onRetry, onNewQuestion }: Props) {
  const criteria: RubricCriterion[] = grading.axes.map(a => ({
    label: a.label,
    score: a.score,
    max: 5,
    feedback: a.feedback,
  }))

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 p-4">
      {/* Question recap */}
      <div className="glass-card p-3">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
          Sujet
        </div>
        <p className="text-base text-[var(--text-heading)] font-semibold">{task.question}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">{task.themeLabel}</p>
      </div>

      {/* Rubric */}
      <GradedRubric
        criteria={criteria}
        overall={{
          score: grading.overall.score,
          max: 30,
          topMistake: grading.overall.topMistake,
          strength: grading.overall.strength,
        }}
      />

      {/* Common pitfalls */}
      {task.commonPitfalls.length > 0 && (
        <div className="glass-card p-4 border border-[var(--color-warning-border)]">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] " />
            <span className="text-sm font-semibold text-[var(--text-heading)]">
              Pièges typiques du sujet
            </span>
          </div>
          <ul className="space-y-1.5">
            {task.commonPitfalls.map((p, i) => (
              <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                <span className="text-[var(--text-muted)] shrink-0">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Side-by-side */}
      <SideBySide task={task} submission={submission} />

      {/* Sources revealed */}
      <SourcesBlock task={task} />

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-card)]"
        >
          <RefreshCw className="w-4 h-4" />
          Reprendre ce sujet
        </button>
        <button
          type="button"
          onClick={onNewQuestion}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90"
        >
          Nouveau sujet
        </button>
      </div>
    </div>
  )
}

function SideBySide({ task, submission }: { task: PlanTask; submission: PlanSubmission }) {
  const [open, setOpen] = useState(true)
  const m = task.modelPlan
  const rows: Array<{ label: string; student: string; model: string }> = [
    {
      label: 'Problématique',
      student: submission.problematique || '(vide)',
      model: m.problematique,
    },
    {
      label: 'I. Titre',
      student: submission.I.title || '(vide)',
      model: m.I.title,
    },
    {
      label: 'I/A',
      student: submission.I.IA || '(vide)',
      model: `${m.I.IA}\n↳ ${m.anchors.IA}`,
    },
    {
      label: 'I/B',
      student: submission.I.IB || '(vide)',
      model: `${m.I.IB}\n↳ ${m.anchors.IB}`,
    },
    {
      label: 'II. Titre',
      student: submission.II.title || '(vide)',
      model: m.II.title,
    },
    {
      label: 'II/A',
      student: submission.II.IIA || '(vide)',
      model: `${m.II.IIA}\n↳ ${m.anchors.IIA}`,
    },
    {
      label: 'II/B',
      student: submission.II.IIB || '(vide)',
      model: `${m.II.IIB}\n↳ ${m.anchors.IIB}`,
    },
    {
      label: 'Transition I → II',
      student: '(non demandé)',
      model: m.transitions.I_to_II,
    },
  ]
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)]"
      >
        <span className="text-sm font-semibold text-[var(--text-heading)]">
          Comparaison ligne à ligne
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>
      {open && (
        <div className="border-t border-[var(--border-card)] divide-y divide-[var(--border-card)]">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
                  {row.label} — votre copie
                </div>
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                  {row.student}
                </p>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--accent-text)] font-semibold mb-1">
                  {row.label} — modèle
                </div>
                <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                  {row.model}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SourcesBlock({ task }: { task: PlanTask }) {
  const [open, setOpen] = useState(false)
  if (task.sourceArticles.length === 0) return null
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)]"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-heading)]">
          <BookOpen className="w-4 h-4" />
          Articles à ancrer ({task.sourceArticles.length})
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>
      {open && (
        <div className="border-t border-[var(--border-card)] divide-y divide-[var(--border-card)]">
          {task.sourceArticles.map((a, i) => (
            <div key={i} className="p-4">
              <div className="flex items-start gap-2 mb-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)]">
                  Art. {a.articleNum}
                </span>
                <span className="text-xs text-[var(--text-muted)] pt-0.5">{a.codeName}</span>
              </div>
              {a.breadcrumb && (
                <p className="text-xs text-[var(--text-muted)] mb-1">{a.breadcrumb}</p>
              )}
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{a.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
