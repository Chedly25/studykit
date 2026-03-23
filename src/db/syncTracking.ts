/**
 * Dexie change tracking for incremental sync.
 * Attaches hooks to all syncable tables to queue changes.
 * Uses an in-memory buffer flushed every 1s to avoid transaction deadlocks.
 */
import { db } from './index'
import type { SyncQueueEntry } from './schema'

// Tables excluded from incremental sync
const EXCLUDED_TABLES = new Set([
  'documentFiles',        // PDF blobs — too large, use full backup
  'chunkEmbeddings',      // derived data, regeneratable
  'topicEmbeddings',      // derived data, regeneratable
  '_syncQueue',           // meta table
  '_syncMeta',            // meta table
  'backgroundJobs',       // ephemeral, device-specific
  'userPreferences',      // global singleton
])

// Module flag: disable tracking during pull to prevent infinite loop
let isSyncing = false

export function setSyncing(value: boolean) {
  isSyncing = value
}

// In-memory buffer for pending changes
let pendingChanges: SyncQueueEntry[] = []
let flushInterval: ReturnType<typeof setInterval> | null = null

function queueChange(table: string, recordId: string, operation: 'put' | 'delete', data?: unknown) {
  if (isSyncing) return
  pendingChanges.push({
    table,
    recordId: String(recordId),
    operation,
    data: operation === 'put' ? data : undefined,
    timestamp: new Date().toISOString(),
  })
}

async function flushQueue() {
  if (pendingChanges.length === 0) return
  const batch = pendingChanges.splice(0)
  try {
    await db._syncQueue.bulkAdd(batch)
  } catch {
    // If flush fails, put items back for retry
    pendingChanges.unshift(...batch)
  }
}

/**
 * Initialize sync tracking on all syncable tables.
 * Call once after DB is ready.
 */
export function initSyncTracking() {
  const tableNames = db.tables.map(t => t.name).filter(n => !EXCLUDED_TABLES.has(n))

  for (const tableName of tableNames) {
    const table = db.table(tableName)

    table.hook('creating', function (_primKey: unknown, obj: unknown) {
      const id = (obj as Record<string, unknown>)?.id ?? _primKey
      queueChange(tableName, String(id), 'put', obj)
    })

    table.hook('updating', function (_mods: unknown, primKey: unknown, obj: unknown) {
      const merged = { ...(obj as Record<string, unknown>), ...(_mods as Record<string, unknown>) }
      queueChange(tableName, String(primKey), 'put', merged)
    })

    table.hook('deleting', function (primKey: unknown) {
      queueChange(tableName, String(primKey), 'delete')
    })
  }

  // Start flush interval
  if (!flushInterval) {
    flushInterval = setInterval(flushQueue, 1000)
  }
}

/**
 * Stop sync tracking (cleanup).
 */
export function stopSyncTracking() {
  if (flushInterval) {
    clearInterval(flushInterval)
    flushInterval = null
  }
  // Final flush
  flushQueue().catch(() => {})
}
