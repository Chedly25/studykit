/**
 * Incremental sync — push deltas and pull changes from cloud.
 * Uses the _syncQueue table for outbound changes and /api/sync-push, /api/sync-pull endpoints.
 */
import { db } from '../db'
import { setSyncing } from '../db/syncTracking'

const SYNC_API_BASE = '/api'

// Whitelist of tables that may be written to during sync pull
const SYNCABLE_TABLES = new Set([
  'subjects', 'chapters', 'topics', 'subtopics', 'studySessions',
  'questionResults', 'documents', 'documentChunks', 'dailyStudyLogs',
  'notifications', 'conceptCards', 'exercises', 'exerciseAttempts',
  'examSources', 'masterySnapshots', 'pdfHighlights', 'flashcardDecks',
  'flashcards', 'tutorPreferences', 'studentModels', 'assignments',
  'notificationPreferences', 'conversations', 'chatMessages', 'chatFeedback',
  'conversationSummaries', 'studyPlans', 'studyPlanDays',
  'practiceExamSessions', 'generatedQuestions', 'examFormats',
  'revisionFiches', 'examDNA', 'misconceptions', 'agentInsights',
  'agentRuns', 'achievements', 'macroRoadmaps',
  'habitGoals', 'habitLogs', 'reviewProjects', 'reviewArticles',
  'annotations', 'contentEffectiveness', 'tutoringEpisodes',
  'milestones', 'researchNotes', 'writingSessions', 'advisorMeetings',
])

interface PushResult {
  success: boolean
  changesStored: number
  error?: string
}

interface PullResult {
  success: boolean
  changesApplied: number
  error?: string
}

/**
 * Push local changes to cloud.
 * Reads _syncQueue, deduplicates, sends to server, clears processed entries.
 */
export async function pushDelta(profileId: string, authToken: string): Promise<PushResult> {
  try {
    // Read all pending queue entries
    const queue = await db._syncQueue.toArray()
    if (queue.length === 0) {
      return { success: true, changesStored: 0 }
    }

    // Deduplicate: keep only the latest entry per table:recordId
    const deduped = new Map<string, typeof queue[0]>()
    for (const entry of queue) {
      const key = `${entry.table}:${entry.recordId}`
      const existing = deduped.get(key)
      if (!existing || entry.timestamp > existing.timestamp) {
        deduped.set(key, entry)
      }
    }

    const changes = [...deduped.values()].map(e => ({
      table: e.table,
      recordId: e.recordId,
      operation: e.operation,
      data: e.data,
      timestamp: e.timestamp,
    }))

    const clientTimestamp = new Date().toISOString()

    const res = await fetch(`${SYNC_API_BASE}/sync-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ profileId, changes, clientTimestamp }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Push failed' }))
      return { success: false, changesStored: 0, error: (err as { error: string }).error }
    }

    // Atomically clear queue entries and update metadata (prevents data loss on crash)
    const processedIds = queue.map(e => e.id!).filter(Boolean)
    await db.transaction('rw', db._syncQueue, db._syncMeta, async () => {
      await db._syncQueue.bulkDelete(processedIds)
      await db._syncMeta.put({
        id: profileId,
        lastPushedAt: clientTimestamp,
        lastPulledAt: (await db._syncMeta.get(profileId))?.lastPulledAt ?? '',
        lastSnapshotAt: (await db._syncMeta.get(profileId))?.lastSnapshotAt ?? '',
      })
    })

    return { success: true, changesStored: changes.length }
  } catch (err) {
    return { success: false, changesStored: 0, error: err instanceof Error ? err.message : 'Push failed' }
  }
}

/**
 * Pull remote changes from cloud.
 * Fetches changes since lastPulledAt, applies to local DB with conflict resolution.
 */
export async function pullDelta(profileId: string, authToken: string): Promise<PullResult> {
  try {
    const meta = await db._syncMeta.get(profileId)
    const since = meta?.lastPulledAt ?? '1970-01-01T00:00:00Z'

    const res = await fetch(`${SYNC_API_BASE}/sync-pull?profileId=${profileId}&since=${encodeURIComponent(since)}`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Pull failed' }))
      return { success: false, changesApplied: 0, error: (err as { error: string }).error }
    }

    const result = await res.json() as {
      changes: Array<{ table: string; recordId: string; operation: string; data?: unknown; timestamp: string }>
      serverTimestamp: string
    }

    if (result.changes.length === 0) {
      // Update lastPulledAt even with no changes (so we don't re-fetch)
      await db._syncMeta.put({
        id: profileId,
        lastPushedAt: meta?.lastPushedAt ?? '',
        lastPulledAt: result.serverTimestamp,
        lastSnapshotAt: meta?.lastSnapshotAt ?? '',
      })
      return { success: true, changesApplied: 0 }
    }

    // Disable sync tracking during pull to avoid re-queuing incoming changes
    setSyncing(true)

    let applied = 0
    try {
      for (const change of result.changes) {
        // Only allow writes to whitelisted tables
        if (!SYNCABLE_TABLES.has(change.table)) continue

        const table = (db as unknown as Record<string, { put: (d: unknown) => Promise<unknown>; delete: (id: string) => Promise<void> }>)[change.table]
        if (!table) continue

        try {
          if (change.operation === 'put' && change.data) {
            // Validate profile ownership when the field exists
            const data = change.data as Record<string, unknown>
            if ('examProfileId' in data && data.examProfileId !== profileId) continue
            await table.put(change.data)
            applied++
          } else if (change.operation === 'delete') {
            await table.delete(change.recordId)
            applied++
          }
        } catch {
          // Skip individual record errors (schema mismatch, etc.)
        }
      }
    } finally {
      setSyncing(false)
    }

    // Update sync metadata
    await db._syncMeta.put({
      id: profileId,
      lastPushedAt: meta?.lastPushedAt ?? '',
      lastPulledAt: result.serverTimestamp,
      lastSnapshotAt: meta?.lastSnapshotAt ?? '',
    })

    return { success: true, changesApplied: applied }
  } catch (err) {
    setSyncing(false)
    return { success: false, changesApplied: 0, error: err instanceof Error ? err.message : 'Pull failed' }
  }
}
