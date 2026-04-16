/**
 * Grading results view: rubric + side-by-side model vs student submission.
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, BookOpen } from 'lucide-react'
import { GradedRubric, type RubricCriterion } from './GradedRubric'
import type {
  SyllogismeGrading,
  SyllogismeSubmission,
  SyllogismeTask,
} from '../../ai/coaching/types'

interface Props {
  task: SyllogismeTask
  submission: SyllogismeSubmission
  grading: SyllogismeGrading
  onRetry: () => void
  onNewScenario: () => void
}

export function SyllogismeResults({ task, submission, grading, onRetry, onNewScenario }: Props) {
  const criteria: RubricCriterion[] = [
    {
      label: 'Majeure',
      score: grading.majeure.score,
      max: 10,
      feedback: grading.majeure.feedback,
      subItems: [
        { label: 'Article correctement cité', passed: grading.majeure.articleCorrect },
        ...grading.majeure.elementsIdentified.map(e => ({
          label: e.element,
          passed: e.found,
        })),
      ],
    },
    {
      label: 'Mineure',
      score: grading.mineure.score,
      max: 10,
      feedback: grading.mineure.feedback,
      subItems: grading.mineure.mappings.map(m => ({
        label: m.element,
        passed: m.mapped,
        note: m.note,
      })),
    },
    {
      label: 'Conclusion',
      score: grading.conclusion.score,
      max: 10,
      feedback: grading.conclusion.feedback,
      subItems: [
        { label: 'Explicite', passed: grading.conclusion.explicit },
        { label: 'Justifiée', passed: grading.conclusion.justified },
        { label: 'Nuancée', passed: grading.conclusion.nuanced },
      ],
    },
  ]

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 p-4">
      {/* Question recap */}
      <div className="glass-card p-3">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
          Sujet
        </div>
        <p className="text-sm text-[var(--text-secondary)]">{task.scenario}</p>
        <p className="text-sm text-[var(--text-heading)] font-medium pt-2">{task.question}</p>
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

      {/* Side-by-side model vs student */}
      <SideBySide task={task} submission={submission} />

      {/* Sources */}
      <SourcesBlock task={task} />

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-card)]"
        >
          <RefreshCw className="w-4 h-4" />
          Reprendre ce scénario
        </button>
        <button
          type="button"
          onClick={onNewScenario}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90"
        >
          Nouveau scénario
        </button>
      </div>
    </div>
  )
}

function SideBySide({ task, submission }: { task: SyllogismeTask; submission: SyllogismeSubmission }) {
  const [open, setOpen] = useState(true)
  const m = task.modelSyllogisme
  const rows: Array<{ label: string; student: string; model: string }> = [
    {
      label: 'Majeure',
      student: submission.majeure || '(vide)',
      model: `${m.majeure.article} — ${m.majeure.rule}\nÉléments : ${m.majeure.elements.join(' ; ')}`,
    },
    {
      label: 'Mineure',
      student: submission.mineure || '(vide)',
      model: m.mineure.factMappings.map(fm => `• ${fm.element} ← ${fm.fact}`).join('\n'),
    },
    {
      label: 'Conclusion',
      student: submission.conclusion || '(vide)',
      model: `${m.conclusion.answer}\n${m.conclusion.justification}`,
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

function SourcesBlock({ task }: { task: SyllogismeTask }) {
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
          Articles utilisés ({task.sourceArticles.length})
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
