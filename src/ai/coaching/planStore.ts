/**
 * IndexedDB persistence for the Plan Détaillé Coach.
 * Mirrors syllogismeStore; uses type='plan-detaille' on the coachingSessions table.
 */

import { db } from '../../db'
import type { CoachingSession } from '../../db/schema'
import type { PlanGrading, PlanSubmission, PlanTask } from './types'

const TYPE = 'plan-detaille' as const

export interface PlanSessionView {
  id: string
  task: PlanTask
  submission?: PlanSubmission
  grading?: PlanGrading
  createdAt: string
  completedAt?: string
}

function hydrate(row: CoachingSession): PlanSessionView {
  return {
    id: row.id,
    task: JSON.parse(row.task) as PlanTask,
    submission: row.submission ? (JSON.parse(row.submission) as PlanSubmission) : undefined,
    grading: row.grading ? (JSON.parse(row.grading) as PlanGrading) : undefined,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }
}

export async function createPlanSession(examProfileId: string, task: PlanTask): Promise<string> {
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

export async function savePlanSubmission(id: string, submission: PlanSubmission): Promise<void> {
  await db.coachingSessions.update(id, { submission: JSON.stringify(submission) })
}

export async function savePlanGrading(id: string, grading: PlanGrading): Promise<void> {
  await db.coachingSessions.update(id, {
    grading: JSON.stringify(grading),
    completedAt: new Date().toISOString(),
  })
}

export async function loadPlanSession(id: string): Promise<PlanSessionView | undefined> {
  const row = await db.coachingSessions.get(id)
  if (!row || row.type !== TYPE) return undefined
  return hydrate(row)
}

export async function listPlanSessions(examProfileId: string): Promise<PlanSessionView[]> {
  const rows = await db.coachingSessions
    .where('[examProfileId+type]')
    .equals([examProfileId, TYPE])
    .toArray()
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return rows.map(hydrate)
}

export async function deletePlanSession(id: string): Promise<void> {
  await db.coachingSessions.delete(id)
}
