/**
 * IndexedDB persistence for the Note de synthèse coach.
 * Uses type='note-synthese' on the coachingSessions table.
 *
 * Unlike other coaches, this one has a "generating" phase where dossier data
 * lives in practiceExamSessions. `snapshotDossier` copies it into the coaching
 * session's task field when generation completes.
 */

import { db } from '../../db'
import type { CoachingSession } from '../../db/schema'
import type {
  NoteSyntheseGrading,
  NoteSyntheseSubmission,
  NoteSyntheseTask,
  NoteSyntheseDossierDocument,
  NoteSyntheseRubricCriterion,
} from './types'
import type { RealDossierBlueprint } from '../prompts/syntheseRealPrompts'

const TYPE = 'note-synthese' as const

export interface NoteSyntheseSessionView {
  id: string
  task: NoteSyntheseTask | null  // null while generating
  submission?: NoteSyntheseSubmission
  grading?: NoteSyntheseGrading
  createdAt: string
  completedAt?: string
  /** Set while the dossier is being generated */
  generating?: { practiceExamSessionId: string; genJobId: string }
}

interface GeneratingTask {
  generating: true
  practiceExamSessionId: string
  genJobId: string
}

function isGeneratingTask(parsed: unknown): parsed is GeneratingTask {
  return typeof parsed === 'object' && parsed !== null && (parsed as Record<string, unknown>).generating === true
}

function hydrate(row: CoachingSession): NoteSyntheseSessionView {
  const parsed = JSON.parse(row.task)
  if (isGeneratingTask(parsed)) {
    return {
      id: row.id,
      task: null,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      generating: {
        practiceExamSessionId: parsed.practiceExamSessionId,
        genJobId: parsed.genJobId,
      },
    }
  }
  return {
    id: row.id,
    task: parsed as NoteSyntheseTask,
    submission: row.submission ? (JSON.parse(row.submission) as NoteSyntheseSubmission) : undefined,
    grading: row.grading ? (JSON.parse(row.grading) as NoteSyntheseGrading) : undefined,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }
}

/**
 * Create a session in "generating" state, before the dossier is ready.
 */
export async function createNoteSyntheseSession(
  examProfileId: string,
  practiceExamSessionId: string,
  genJobId: string,
): Promise<string> {
  const id = crypto.randomUUID()
  const generatingTask: GeneratingTask = {
    generating: true,
    practiceExamSessionId,
    genJobId,
  }
  await db.coachingSessions.put({
    id,
    examProfileId,
    type: TYPE,
    task: JSON.stringify(generatingTask),
    createdAt: new Date().toISOString(),
  })
  return id
}

/**
 * Copy dossier artifacts from practiceExamSessions into the coaching session's task.
 * Called when the background generation job completes.
 */
export async function snapshotDossier(id: string, practiceExamSessionId: string): Promise<NoteSyntheseTask> {
  const pes = await db.practiceExamSessions.get(practiceExamSessionId)
  if (!pes) throw new Error('Practice exam session not found')
  if (!pes.dossierContent) throw new Error('Dossier content not ready')

  let blueprint: RealDossierBlueprint
  try {
    blueprint = JSON.parse(pes.dossierBlueprint ?? '{}')
  } catch {
    blueprint = { theme: 'Inconnu', problematique: '', planSuggere: { I: '', IA: '', IB: '', II: '', IIA: '', IIB: '' }, documentSlots: [] }
  }

  let documents: NoteSyntheseDossierDocument[]
  try {
    documents = JSON.parse(pes.dossierContent)
  } catch {
    documents = []
  }

  let rubric: { criteria: NoteSyntheseRubricCriterion[]; totalPoints: number; documentCoverageMap: Record<string, string> }
  try {
    rubric = JSON.parse(pes.synthesisRubric ?? '{}')
  } catch {
    rubric = { criteria: [], totalPoints: 20, documentCoverageMap: {} }
  }

  const task: NoteSyntheseTask = {
    dossierTitle: blueprint.theme,
    problematique: blueprint.problematique,
    planSuggere: blueprint.planSuggere ?? { I: '', IA: '', IB: '', II: '', IIA: '', IIB: '' },
    documents,
    modelSynthesis: pes.synthesisModelAnswer ?? '',
    rubric,
    generatedAt: new Date().toISOString(),
    practiceExamSessionId,
  }

  await db.coachingSessions.update(id, { task: JSON.stringify(task) })
  return task
}

export async function saveNoteSyntheseSubmission(id: string, submission: NoteSyntheseSubmission): Promise<void> {
  await db.coachingSessions.update(id, { submission: JSON.stringify(submission) })
}

export async function saveNoteSyntheseGrading(id: string, grading: NoteSyntheseGrading): Promise<void> {
  await db.coachingSessions.update(id, {
    grading: JSON.stringify(grading),
    completedAt: new Date().toISOString(),
  })
}

export async function loadNoteSyntheseSession(id: string): Promise<NoteSyntheseSessionView | undefined> {
  const row = await db.coachingSessions.get(id)
  if (!row || row.type !== TYPE) return undefined
  return hydrate(row)
}

export async function listNoteSyntheseSessions(examProfileId: string): Promise<NoteSyntheseSessionView[]> {
  const rows = await db.coachingSessions
    .where('[examProfileId+type]')
    .equals([examProfileId, TYPE])
    .toArray()
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return rows.map(hydrate)
}

export async function deleteNoteSyntheseSession(id: string): Promise<void> {
  // Load the session to find linked practiceExamSession
  const row = await db.coachingSessions.get(id)
  if (row) {
    try {
      const parsed = JSON.parse(row.task)
      const pesId = parsed.practiceExamSessionId
      if (pesId) {
        await db.practiceExamSessions.delete(pesId)
      }
    } catch { /* best effort cleanup */ }
  }
  await db.coachingSessions.delete(id)
}
