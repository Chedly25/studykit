/**
 * Global background jobs indicator — shows in the header when jobs are active.
 * Reads job state from IndexedDB via useLiveQuery (no prop drilling needed).
 */
import { useState } from 'react'
import { Loader2, XCircle, X } from 'lucide-react'
import { useActiveJobs } from '../hooks/useActiveJobs'
import { useBackgroundJobs } from './BackgroundJobsProvider'
import type { BackgroundJob, JobType } from '../db/schema'

const JOB_LABELS: Record<JobType, string> = {
  'source-processing': 'Processing document',
  'exam-exercise-processing': 'Extracting exercises',
  'article-review-batch': 'Reviewing articles',
  'article-synthesis': 'Synthesizing results',
  'practice-exam-generation': 'Generating exam',
  'practice-exam-grading': 'Grading exam',
  'study-plan': 'Generating study plan',
  'session-insight': 'Analyzing session',
  'exam-research': 'Researching exam format',
  'misconception-exercise': 'Generating targeted exercises',
  'exam-simulation': 'Running exam simulation',
  'document-exam-generation': 'Generating document exam',
  'document-exam-grading': 'Grading document exam',
  'synthesis-generation': 'Generating synthesis exam',
  'synthesis-grading': 'Grading synthesis',
  'cas-pratique-generation': 'Generating cas pratique',
  'grand-oral-generation': 'Generating grand oral',
  'fiche-generation': 'Generating revision fiche',
  'exam-dna-analysis': 'Analyzing exam DNA',
  'library-sync': 'Syncing content library',
}

export function BackgroundJobsIndicator() {
  const activeJobs = useActiveJobs()
  const { cancel } = useBackgroundJobs()
  const [open, setOpen] = useState(false)

  if (activeJobs.length === 0) return null

  const runningCount = activeJobs.filter(j => j.status === 'running').length
  const queuedCount = activeJobs.filter(j => j.status === 'queued').length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-xs font-medium hover:bg-[var(--accent-text)]/20 transition-colors"
      >
        <Loader2 size={14} className="animate-spin" />
        {activeJobs.length === 1 ? (
          <span className="truncate max-w-[160px]">{JOB_LABELS[activeJobs[0].type] ?? activeJobs[0].type}...</span>
        ) : (
          <span>{runningCount + queuedCount} processing</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 z-50 glass-card p-3 shadow-lg animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--text-heading)]">
                Background Tasks
              </span>
              <button onClick={() => setOpen(false)} className="text-[var(--text-faint)] hover:text-[var(--text-muted)]">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {activeJobs.map(job => (
                <JobRow key={job.id} job={job} onCancel={() => cancel(job.id)} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function JobRow({ job, onCancel }: { job: BackgroundJob; onCancel: () => void }) {
  const label = JOB_LABELS[job.type] ?? job.type
  const isBatch = !!job.batchItemIds

  let progressText: string
  let progressPct: number

  if (isBatch) {
    const totalItems = JSON.parse(job.batchItemIds!).length as number
    const completedItems = job.batchCompletedIds ? (JSON.parse(job.batchCompletedIds) as string[]).length : 0
    const failedItems = job.batchFailedIds ? (JSON.parse(job.batchFailedIds) as string[]).length : 0
    progressText = `${completedItems + failedItems}/${totalItems} items`
    progressPct = totalItems > 0 ? (completedItems + failedItems) / totalItems : 0
  } else {
    progressText = job.currentStepName || (job.status === 'queued' ? 'Queued' : 'Starting...')
    progressPct = job.totalSteps > 0 ? job.completedStepCount / job.totalSteps : 0
  }

  return (
    <div className="p-2 rounded-lg bg-[var(--bg-input)]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-[var(--text-heading)] truncate flex-1">
          {label}
        </span>
        <button
          onClick={onCancel}
          className="text-[var(--text-faint)] hover:text-[var(--color-error)] transition-colors ml-2 shrink-0"
          title="Cancel"
        >
          <XCircle size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-[var(--border-card)] overflow-hidden mb-1">
        <div
          className="h-full rounded-full bg-[var(--accent-text)] transition-all duration-300"
          style={{ width: `${Math.max(progressPct * 100, 2)}%` }}
        />
      </div>

      <span className="text-[10px] text-[var(--text-faint)]">{progressText}</span>
    </div>
  )
}
