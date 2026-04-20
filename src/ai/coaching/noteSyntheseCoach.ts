/**
 * Note de synthèse coach — dossier generation trigger + synchronous grading.
 *
 * Generation reuses the existing real-doc background pipeline (syntheseGenerationReal).
 * Grading uses coachingCallJson for synchronous one-shot evaluation.
 */

import { db } from '../../db'
import type { JobType, PracticeExamSession } from '../../db/schema'
import { coachingCallJson } from './coachingClient'
import { buildNoteSyntheseGradingPrompt } from '../prompts/noteSynthesePrompts'
import type {
  NoteSyntheseGrading,
  NoteSyntheseSubmission,
  NoteSyntheseTask,
} from './types'

const GRADING_MAX_TOKENS = 4000

// ─── Dossier generation (background job) ─────────────────────

export interface TriggerDossierOpts {
  examProfileId: string
  sourcesEnabled: boolean
  enqueue: (type: JobType, examProfileId: string, config: Record<string, unknown>, totalSteps: number) => Promise<string>
}

/**
 * Create a practiceExamSession and enqueue the real-doc generation workflow.
 * Returns the session ID and background job ID for tracking.
 */
export async function triggerDossierGeneration(opts: TriggerDossierOpts): Promise<{
  practiceExamSessionId: string
  genJobId: string
}> {
  const id = crypto.randomUUID()
  const session: PracticeExamSession = {
    id,
    examProfileId: opts.examProfileId,
    phase: 'generating',
    questionCount: 0,
    sourcesEnabled: opts.sourcesEnabled,
    examMode: 'synthesis',
    createdAt: new Date().toISOString(),
  }
  await db.practiceExamSessions.put(session)

  const genJobId = await opts.enqueue(
    'synthesis-generation',
    opts.examProfileId,
    { sessionId: id, sourcesEnabled: opts.sourcesEnabled },
    7, // gatherContext + architect + sourcing + curation + synthesisWriter + qualityPass + rubricBuilder
  )

  return { practiceExamSessionId: id, genJobId }
}

// ─── Grading (synchronous) ───────────────────────────────────

export interface GradeNoteSyntheseOpts {
  task: NoteSyntheseTask
  submission: NoteSyntheseSubmission
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

type NoteSyntheseGradingRaw = Omit<NoteSyntheseGrading, 'gradedAt'>

export async function gradeNoteSynthese(opts: GradeNoteSyntheseOpts): Promise<NoteSyntheseGrading> {
  const { system, user } = buildNoteSyntheseGradingPrompt({
    task: opts.task,
    submission: opts.submission,
  })

  const raw = await coachingCallJson<NoteSyntheseGradingRaw>({
    system,
    user,
    maxTokens: GRADING_MAX_TOKENS,
    authToken: opts.authToken,
    getToken: opts.getToken,
    signal: opts.signal,
  })

  return { ...raw, gradedAt: new Date().toISOString() }
}
