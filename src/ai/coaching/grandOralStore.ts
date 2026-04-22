/**
 * IndexedDB persistence for the Grand Oral coach.
 * Uses type='grand-oral' on the coachingSessions table.
 */

import { db } from '../../db'
import type { CoachingSession } from '../../db/schema'
import type { GrandOralGrading, GrandOralSubmission, GrandOralTask } from './types'

const TYPE = 'grand-oral' as const

export interface GrandOralSessionView {
  id: string
  task: GrandOralTask
  submission?: GrandOralSubmission
  grading?: GrandOralGrading
  createdAt: string
  completedAt?: string
}

function hydrate(row: CoachingSession): GrandOralSessionView {
  return {
    id: row.id,
    task: JSON.parse(row.task) as GrandOralTask,
    submission: row.submission ? (JSON.parse(row.submission) as GrandOralSubmission) : undefined,
    grading: row.grading ? (JSON.parse(row.grading) as GrandOralGrading) : undefined,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }
}

export async function createGrandOralSession(examProfileId: string, task: GrandOralTask): Promise<string> {
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

export async function saveGrandOralSubmission(id: string, submission: GrandOralSubmission): Promise<void> {
  await db.coachingSessions.update(id, { submission: JSON.stringify(submission) })
}

export async function saveGrandOralGrading(id: string, grading: GrandOralGrading): Promise<void> {
  await db.coachingSessions.update(id, {
    grading: JSON.stringify(grading),
    completedAt: new Date().toISOString(),
  })
}

export async function loadGrandOralSession(id: string): Promise<GrandOralSessionView | undefined> {
  const row = await db.coachingSessions.get(id)
  if (!row || row.type !== TYPE) return undefined
  return hydrate(row)
}

export async function listGrandOralSessions(examProfileId: string): Promise<GrandOralSessionView[]> {
  const rows = await db.coachingSessions
    .where('[examProfileId+type]')
    .equals([examProfileId, TYPE])
    .toArray()
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return rows.map(hydrate)
}

export async function deleteGrandOralSession(id: string): Promise<void> {
  await db.coachingSessions.delete(id)
}
