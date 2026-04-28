/**
 * Cas pratique results — 6-axis rubric (/20) + issues identified/missed chips +
 * student submission vs model answer side-by-side.
 */
import { useState } from 'react'
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CasPratiqueTask, CasPratiqueGrading, CasPratiqueSubmission } from '../../ai/coaching/types'
import { GradedRubric } from './GradedRubric'
import type { RubricCriterion } from './GradedRubric'

interface Props {
  task: CasPratiqueTask
  submission: CasPratiqueSubmission
  grading: CasPratiqueGrading
  onRestart?: () => void
}

export function CasPratiqueResults({ task, submission, grading, onRestart }: Props) {
  const criteria: RubricCriterion[] = grading.axes.map(a => ({
    label: a.label,
    score: a.score,
    max: a.max,
    feedback: a.feedback,
  }))

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 p-4">
      <GradedRubric
        criteria={criteria}
        overall={{
          score: grading.overall.score,
          max: 20,
          topMistake: grading.overall.topMistake,
          strength: grading.overall.strength,
        }}
      />

      <IssueChips task={task} grading={grading} />

      <SubmissionVsModel task={task} submission={submission} />

      {onRestart && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onRestart}
            className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)] border border-[var(--border-card)]"
          >
            Nouveau cas pratique
          </button>
        </div>
      )}
    </div>
  )
}

function IssueChips({ task, grading }: { task: CasPratiqueTask; grading: CasPratiqueGrading }) {
  const identified = new Set(grading.overall.identifiedIssues ?? [])
  const missed = new Set(grading.overall.missedIssues ?? [])

  return (
    <div className="glass-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-heading)]">
        Problèmes attendus
      </h3>
      <ul className="space-y-2">
        {task.legalIssues.map((issue, i) => {
          const wasIdentified = identified.has(i)
          const wasMissed = missed.has(i)
          const status = wasIdentified ? 'identified' : wasMissed ? 'missed' : 'unknown'
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              {status === 'identified' ? (
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-success)] " />
              ) : status === 'missed' ? (
                <X className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-error)] " />
              ) : (
                <span className="w-4 h-4 mt-0.5 shrink-0 rounded-full border border-[var(--text-muted)]" />
              )}
              <span className={
                status === 'missed'
                  ? 'text-[var(--text-body)]'
                  : status === 'identified'
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)]'
              }>
                {issue}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SubmissionVsModel({ task, submission }: { task: CasPratiqueTask; submission: CasPratiqueSubmission }) {
  const [view, setView] = useState<'student' | 'model' | 'both'>('both')
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-3 border-b border-[var(--border-card)]">
        <h3 className="text-sm font-semibold text-[var(--text-heading)]">Comparaison</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-[var(--bg-input)] p-0.5">
            <ViewTab active={view === 'student'} onClick={() => setView('student')} label="Ta copie" />
            <ViewTab active={view === 'both'} onClick={() => setView('both')} label="Les deux" />
            <ViewTab active={view === 'model'} onClick={() => setView('model')} label="Modèle" />
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className={`${view === 'both' ? 'grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-card)]' : 'block'}`}>
          {(view === 'student' || view === 'both') && (
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">
                Ta copie
              </div>
              <div className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                {submission.answer || '(vide)'}
              </div>
            </div>
          )}
          {(view === 'model' || view === 'both') && (
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">
                Consultation modèle
              </div>
              <div className="text-sm text-[var(--text-primary)] leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.modelAnswer}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ViewTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--bg-card)] text-[var(--accent-text)] shadow-sm'
          : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
      }`}
    >
      {label}
    </button>
  )
}
