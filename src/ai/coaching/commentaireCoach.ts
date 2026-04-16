/**
 * Commentaire d'arrêt coach — decision picker (reuses Fiche's) + grading.
 */

import { coachingCallJson } from './coachingClient'
import { pickFicheDecision } from './ficheArretCoach'
import { buildCommentaireGradingPrompt } from '../prompts/commentairePrompts'
import type {
  CommentaireGrading,
  CommentaireSubmission,
  CommentaireTask,
} from './types'

const GRADING_MAX_TOKENS = 4000

export interface PickCommentaireDecisionOpts {
  chamberId: string
  excludeIds?: string[]
  authToken: string
  signal?: AbortSignal
}

/**
 * Decision picking is identical to Fiche — same corpus, same filter.
 * Reuse `pickFicheDecision` and repackage into a `CommentaireTask`.
 */
export async function pickCommentaireDecision(opts: PickCommentaireDecisionOpts): Promise<CommentaireTask> {
  const ficheTask = await pickFicheDecision(opts)
  return {
    decision: ficheTask.decision,
    generatedAt: ficheTask.generatedAt,
  }
}

export interface GradeCommentaireOpts {
  task: CommentaireTask
  submission: CommentaireSubmission
  authToken: string
  getToken?: () => Promise<string | null>
  signal?: AbortSignal
}

type CommentaireGradingRaw = Omit<CommentaireGrading, 'gradedAt'>

export async function gradeCommentaireSubmission(opts: GradeCommentaireOpts): Promise<CommentaireGrading> {
  const { system, user } = buildCommentaireGradingPrompt({
    task: opts.task,
    submission: opts.submission,
  })

  const raw = await coachingCallJson<CommentaireGradingRaw>({
    system,
    user,
    maxTokens: GRADING_MAX_TOKENS,
    authToken: opts.authToken,
    getToken: opts.getToken,
    signal: opts.signal,
  })

  return { ...raw, gradedAt: new Date().toISOString() }
}
