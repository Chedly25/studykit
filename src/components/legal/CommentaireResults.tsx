/**
 * Commentaire d'arrêt grading results: 5-axis rubric + student copy recap + decision re-read.
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, FileText } from 'lucide-react'
import { GradedRubric, type RubricCriterion } from './GradedRubric'
import type { CommentaireGrading, CommentaireSubmission, CommentaireTask } from '../../ai/coaching/types'

interface Props {
  task: CommentaireTask
  submission: CommentaireSubmission
  grading: CommentaireGrading
  onRetry: () => void
  onNewDecision: () => void
}

export function CommentaireResults({ task, submission, grading, onRetry, onNewDecision }: Props) {
  const criteria: RubricCriterion[] = grading.axes.map(a => ({
    label: a.label,
    score: a.score,
    max: 5,
    feedback: a.feedback,
  }))

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 p-4">
      {/* Decision recap */}
      <div className="glass-card p-3">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent-text)] font-semibold">
            {task.decision.chamber}
          </span>
          {task.decision.breadcrumb && (
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              {task.decision.breadcrumb}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)] font-mono">{task.decision.reference}</p>
      </div>

      <GradedRubric
        criteria={criteria}
        overall={{
          score: grading.overall.score,
          max: 25,
          topMistake: grading.overall.topMistake,
          strength: grading.overall.strength,
        }}
      />

      <SubmissionRecap submission={submission} />
      <DecisionReRead task={task} />

      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-card)]"
        >
          <RefreshCw className="w-4 h-4" />
          Reprendre cette décision
        </button>
        <button
          type="button"
          onClick={onNewDecision}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90"
        >
          Nouvelle décision
        </button>
      </div>
    </div>
  )
}

function SubmissionRecap({ submission }: { submission: CommentaireSubmission }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)]"
      >
        <span className="text-sm font-semibold text-[var(--text-heading)]">Ta copie</span>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>
      {open && (
        <div className="border-t border-[var(--border-card)] divide-y divide-[var(--border-card)]">
          <Section label="Introduction" content={submission.introduction || '(vide)'} />
          <Section label="I. Titre" content={submission.I.title || '(vide)'} />
          <Section label="I. A." content={submission.I.IA || '(vide)'} />
          <Section label="I. B." content={submission.I.IB || '(vide)'} />
          <Section label="II. Titre" content={submission.II.title || '(vide)'} />
          <Section label="II. A." content={submission.II.IIA || '(vide)'} />
          <Section label="II. B." content={submission.II.IIB || '(vide)'} />
        </div>
      )}
    </div>
  )
}

function Section({ label, content }: { label: string; content: string }) {
  return (
    <div className="p-4">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
        {label}
      </div>
      <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
        {content}
      </p>
    </div>
  )
}

function DecisionReRead({ task }: { task: CommentaireTask }) {
  const [open, setOpen] = useState(false)
  if (!task.decision.text) return null
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)]"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-heading)]">
          <FileText className="w-4 h-4" />
          Relire l'arrêt
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>
      {open && (
        <div className="border-t border-[var(--border-card)] p-4 text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
          {task.decision.text}
        </div>
      )}
    </div>
  )
}
