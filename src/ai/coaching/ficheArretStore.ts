/**
 * IndexedDB persistence for the Fiche d'arrêt Trainer.
 * Mirrors syllogismeStore; uses type='fiche-arret' on the coachingSessions table.
 */

import { db } from '../../db'
import type { CoachingSession } from '../../db/schema'
import type { FicheGrading, FicheSubmission, FicheTask } from './types'

const TYPE = 'fiche-arret' as const

export interface FicheSessionView {
  id: string
  task: FicheTask
  submission?: FicheSubmission
  grading?: FicheGrading
  createdAt: string
  completedAt?: string
}

function hydrate(row: CoachingSession): FicheSessionView {
  return {
    id: row.id,
    task: JSON.parse(row.task) as FicheTask,
    submission: row.submission ? (JSON.parse(row.submission) as FicheSubmission) : undefined,
    grading: row.grading ? (JSON.parse(row.grading) as FicheGrading) : undefined,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }
}

export async function createFicheSession(examProfileId: string, task: FicheTask): Promise<string> {
  const id = crypto.randomUUID()
  await db.coachingSessions.put({
    id,
    examProfileId,
    type: TYPE,
    task: JSON.stringify(task),
    createdAt: new Date().toISOString(),
  })
  return id
}

export async function saveFicheSubmission(id: string, submission: FicheSubmission): Promise<void> {
  await db.coachingSessions.update(id, { submission: JSON.stringify(submission) })
}

export async function saveFicheGrading(id: string, grading: FicheGrading): Promise<void> {
  await db.coachingSessions.update(id, {
    grading: JSON.stringify(grading),
    completedAt: new Date().toISOString(),
  })
}

export async function loadFicheSession(id: string): Promise<FicheSessionView | undefined> {
  const row = await db.coachingSessions.get(id)
  if (!row || row.type !== TYPE) return undefined
  return hydrate(row)
}

export async function listFicheSessions(examProfileId: string): Promise<FicheSessionView[]> {
  const rows = await db.coachingSessions
    .where('[examProfileId+type]')
    .equals([examProfileId, TYPE])
    .toArray()
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return rows.map(hydrate)
}

export async function deleteFicheSession(id: string): Promise<void> {
  await db.coachingSessions.delete(id)
}
