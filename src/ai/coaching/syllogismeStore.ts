/**
 * IndexedDB persistence helpers for the Syllogisme Coach.
 * Thin wrapper over db.coachingSessions (table declared in src/db/index.ts v36).
 */

import { db } from '../../db'
import type { CoachingSession } from '../../db/schema'
import type { SyllogismeGrading, SyllogismeSubmission, SyllogismeTask } from './types'

const TYPE = 'syllogisme' as const

export interface SyllogismeSessionView {
  id: string
  task: SyllogismeTask
  submission?: SyllogismeSubmission
  grading?: SyllogismeGrading
  createdAt: string
  completedAt?: string
}

function hydrate(row: CoachingSession): SyllogismeSessionView {
  return {
    id: row.id,
    task: JSON.parse(row.task) as SyllogismeTask,
    submission: row.submission ? (JSON.parse(row.submission) as SyllogismeSubmission) : undefined,
    grading: row.grading ? (JSON.parse(row.grading) as SyllogismeGrading) : undefined,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }
}

export async function createSyllogismeSession(
  examProfileId: string,
  task: SyllogismeTask,
): Promise<string> {
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

export async function saveSyllogismeSubmission(
  id: string,
  submission: SyllogismeSubmission,
): Promise<void> {
  await db.coachingSessions.update(id, { submission: JSON.stringify(submission) })
}

export async function saveSyllogismeGrading(
  id: string,
  grading: SyllogismeGrading,
): Promise<void> {
  await db.coachingSessions.update(id, {
    grading: JSON.stringify(grading),
    completedAt: new Date().toISOString(),
  })
}

export async function loadSyllogismeSession(
  id: string,
): Promise<SyllogismeSessionView | undefined> {
  const row = await db.coachingSessions.get(id)
  if (!row || row.type !== TYPE) return undefined
  return hydrate(row)
}

export async function listSyllogismeSessions(
  examProfileId: string,
): Promise<SyllogismeSessionView[]> {
  const rows = await db.coachingSessions
    .where('[examProfileId+type]')
    .equals([examProfileId, TYPE])
    .toArray()
  // Newest first
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return rows.map(hydrate)
}

export async function deleteSyllogismeSession(id: string): Promise<void> {
  await db.coachingSessions.delete(id)
}
