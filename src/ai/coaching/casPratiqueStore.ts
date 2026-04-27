/**
 * IndexedDB persistence for the Cas pratique coach.
 * Uses type='cas-pratique' on the coachingSessions table.
 */

import { db } from '../../db'
import type { CoachingSession } from '../../db/schema'
import type { CasPratiqueGrading, CasPratiqueSubmission, CasPratiqueTask } from './types'

const TYPE = 'cas-pratique' as const

export interface CasPratiqueSessionView {
  id: string
  task: CasPratiqueTask
  submission?: CasPratiqueSubmission
  grading?: CasPratiqueGrading
  createdAt: string
  completedAt?: string
}

function hydrate(row: CoachingSession): CasPratiqueSessionView {
  return {
    id: row.id,
    task: JSON.parse(row.task) as CasPratiqueTask,
    submission: row.submission ? (JSON.parse(row.submission) as CasPratiqueSubmission) : undefined,
    grading: row.grading ? (JSON.parse(row.grading) as CasPratiqueGrading) : undefined,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }
}

export async function createCasPratiqueSession(examProfileId: string, task: CasPratiqueTask): Promise<string> {
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

export async function saveCasPratiqueSubmission(id: string, submission: CasPratiqueSubmission): Promise<void> {
  await db.coachingSessions.update(id, { submission: JSON.stringify(submission) })
}

export async function saveCasPratiqueGrading(id: string, grading: CasPratiqueGrading): Promise<void> {
  await db.coachingSessions.update(id, {
    grading: JSON.stringify(grading),
    completedAt: new Date().toISOString(),
  })
}

export async function loadCasPratiqueSession(id: string): Promise<CasPratiqueSessionView | undefined> {
  const row = await db.coachingSessions.get(id)
  if (!row || row.type !== TYPE) return undefined
  return hydrate(row)
}

export async function listCasPratiqueSessions(examProfileId: string): Promise<CasPratiqueSessionView[]> {
  const rows = await db.coachingSessions
    .where('[examProfileId+type]')
    .equals([examProfileId, TYPE])
    .toArray()
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return rows.map(hydrate)
}

export async function deleteCasPratiqueSession(id: string): Promise<void> {
  await db.coachingSessions.delete(id)
}
