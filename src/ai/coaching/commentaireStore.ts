/**
 * IndexedDB persistence for the Commentaire d'arrêt coach.
 * Uses type='commentaire-arret' on the coachingSessions table.
 */

import { db } from '../../db'
import type { CoachingSession } from '../../db/schema'
import type { CommentaireGrading, CommentaireSubmission, CommentaireTask } from './types'

const TYPE = 'commentaire-arret' as const

export interface CommentaireSessionView {
  id: string
  task: CommentaireTask
  submission?: CommentaireSubmission
  grading?: CommentaireGrading
  createdAt: string
  completedAt?: string
}

function hydrate(row: CoachingSession): CommentaireSessionView {
  return {
    id: row.id,
    task: JSON.parse(row.task) as CommentaireTask,
    submission: row.submission ? (JSON.parse(row.submission) as CommentaireSubmission) : undefined,
    grading: row.grading ? (JSON.parse(row.grading) as CommentaireGrading) : undefined,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }
}

export async function createCommentaireSession(examProfileId: string, task: CommentaireTask): Promise<string> {
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

export async function saveCommentaireSubmission(id: string, submission: CommentaireSubmission): Promise<void> {
  await db.coachingSessions.update(id, { submission: JSON.stringify(submission) })
}

export async function saveCommentaireGrading(id: string, grading: CommentaireGrading): Promise<void> {
  await db.coachingSessions.update(id, {
    grading: JSON.stringify(grading),
    completedAt: new Date().toISOString(),
  })
}

export async function loadCommentaireSession(id: string): Promise<CommentaireSessionView | undefined> {
  const row = await db.coachingSessions.get(id)
  if (!row || row.type !== TYPE) return undefined
  return hydrate(row)
}

export async function listCommentaireSessions(examProfileId: string): Promise<CommentaireSessionView[]> {
  const rows = await db.coachingSessions
    .where('[examProfileId+type]')
    .equals([examProfileId, TYPE])
    .toArray()
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return rows.map(hydrate)
}

export async function deleteCommentaireSession(id: string): Promise<void> {
  await db.coachingSessions.delete(id)
}
