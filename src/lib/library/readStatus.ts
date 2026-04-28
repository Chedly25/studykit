/**
 * Read-status helpers for the Bibliothèque page.
 * Per-(profile, entry) row in db.libraryReadStatus tracking
 * unread → reading → read with optional scroll progress.
 */
import { db } from '../../db'
import type { LibraryReadStatus } from '../../db/schema'

function rowId(examProfileId: string, libraryEntryId: string): string {
  return `${examProfileId}:${libraryEntryId}`
}

/** Mark an entry as opened — sets status='reading' and lastOpenedAt=now. Idempotent. */
export async function markOpened(
  examProfileId: string,
  libraryEntryId: string,
): Promise<void> {
  const id = rowId(examProfileId, libraryEntryId)
  const now = new Date().toISOString()
  const existing = await db.libraryReadStatus.get(id)
  if (existing?.status === 'read') {
    // Already read — just update lastOpenedAt, don't downgrade.
    await db.libraryReadStatus.update(id, { lastOpenedAt: now })
    return
  }
  await db.libraryReadStatus.put({
    id,
    examProfileId,
    libraryEntryId,
    status: 'reading',
    lastOpenedAt: now,
    scrollPercent: existing?.scrollPercent ?? 0,
  })
}

/** Mark an entry as read. Idempotent. */
export async function markRead(
  examProfileId: string,
  libraryEntryId: string,
): Promise<void> {
  const id = rowId(examProfileId, libraryEntryId)
  await db.libraryReadStatus.put({
    id,
    examProfileId,
    libraryEntryId,
    status: 'read',
    lastOpenedAt: new Date().toISOString(),
    scrollPercent: 100,
  })
}

/** Reset to unread (e.g. user explicit action or testing). */
export async function markUnread(
  examProfileId: string,
  libraryEntryId: string,
): Promise<void> {
  const id = rowId(examProfileId, libraryEntryId)
  const existing = await db.libraryReadStatus.get(id)
  if (!existing) return
  await db.libraryReadStatus.delete(id)
}

/** Return current status (returns null if no row written). */
export async function getStatus(
  examProfileId: string,
  libraryEntryId: string,
): Promise<LibraryReadStatus | null> {
  return (await db.libraryReadStatus.get(rowId(examProfileId, libraryEntryId))) ?? null
}

/** Return all read-status rows for a profile (for badge rendering on the list). */
export async function getAllStatuses(examProfileId: string): Promise<LibraryReadStatus[]> {
  return db.libraryReadStatus.where('examProfileId').equals(examProfileId).toArray()
}

/** Update scroll progress on a reading entry without changing status. */
export async function updateScrollPercent(
  examProfileId: string,
  libraryEntryId: string,
  percent: number,
): Promise<void> {
  const id = rowId(examProfileId, libraryEntryId)
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const existing = await db.libraryReadStatus.get(id)
  if (!existing) {
    await markOpened(examProfileId, libraryEntryId)
  }
  await db.libraryReadStatus.update(id, { scrollPercent: clamped })
}
