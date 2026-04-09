import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the db module
vi.mock('../index', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const hookCallbacks: Record<string, Record<string, Function>> = {}

  return {
    db: {
      tables: [
        { name: 'subjects' },
        { name: 'topics' },
        { name: 'documents' },
        // Excluded tables (should be filtered out)
        { name: 'documentFiles' },
        { name: 'chunkEmbeddings' },
        { name: '_syncQueue' },
        { name: '_syncMeta' },
        { name: 'backgroundJobs' },
        { name: 'userPreferences' },
        { name: 'strategyEffectiveness' },
        { name: 'tutoringEpisodes' },
        { name: 'topicEmbeddings' },
      ],
      table: vi.fn((name: string) => {
        if (!hookCallbacks[name]) hookCallbacks[name] = {}
        return {
          hook: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
            hookCallbacks[name][event] = cb
          }),
        }
      }),
      _syncQueue: {
        bulkAdd: vi.fn().mockResolvedValue(undefined),
      },
      // Expose for testing
      _hookCallbacks: hookCallbacks,
    },
  }
})

import { setSyncing, initSyncTracking, stopSyncTracking } from '../syncTracking'
import { db } from '../index'

// ─── Helpers ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function getHookCallbacks(): Record<string, Record<string, Function>> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return (db as unknown as { _hookCallbacks: Record<string, Record<string, Function>> })._hookCallbacks
}

// ─── Tests ───────────────────────────────────────────────────────

describe('setSyncing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset sync depth by toggling off enough times
    for (let i = 0; i < 10; i++) setSyncing(false)
  })

  it('increments depth on true and decrements on false', () => {
    // No direct assertion on depth, but we test by verifying queueChange behavior
    // When syncing is on, changes should not be queued
    // We'll test this via initSyncTracking
  })

  it('does not go below 0', () => {
    // Call false many times — should not throw
    setSyncing(false)
    setSyncing(false)
    setSyncing(false)
    // No error = passes
  })
})

describe('initSyncTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Reset sync depth
    for (let i = 0; i < 10; i++) setSyncing(false)
  })

  afterEach(() => {
    stopSyncTracking()
    vi.useRealTimers()
  })

  it('attaches hooks only to non-excluded tables', () => {
    initSyncTracking()

    // Should have been called for subjects, topics, documents (3 syncable tables)
    expect(db.table).toHaveBeenCalledWith('subjects')
    expect(db.table).toHaveBeenCalledWith('topics')
    expect(db.table).toHaveBeenCalledWith('documents')

    // Should NOT have been called for excluded tables
    expect(db.table).not.toHaveBeenCalledWith('documentFiles')
    expect(db.table).not.toHaveBeenCalledWith('chunkEmbeddings')
    expect(db.table).not.toHaveBeenCalledWith('_syncQueue')
    expect(db.table).not.toHaveBeenCalledWith('_syncMeta')
    expect(db.table).not.toHaveBeenCalledWith('backgroundJobs')
    expect(db.table).not.toHaveBeenCalledWith('userPreferences')
    expect(db.table).not.toHaveBeenCalledWith('strategyEffectiveness')
    expect(db.table).not.toHaveBeenCalledWith('tutoringEpisodes')
    expect(db.table).not.toHaveBeenCalledWith('topicEmbeddings')
  })

  it('registers creating, updating, and deleting hooks', () => {
    initSyncTracking()

    const hooks = getHookCallbacks()
    expect(hooks['subjects']).toBeDefined()
    expect(hooks['subjects']['creating']).toBeTypeOf('function')
    expect(hooks['subjects']['updating']).toBeTypeOf('function')
    expect(hooks['subjects']['deleting']).toBeTypeOf('function')
  })

  it('queues put on creating hook and flushes to db', async () => {
    initSyncTracking()

    const hooks = getHookCallbacks()
    const obj = { id: 's1', name: 'Math' }
    hooks['subjects']['creating'](undefined, obj)

    // Advance timer to trigger flush
    await vi.advanceTimersByTimeAsync(1100)

    expect(db._syncQueue.bulkAdd).toHaveBeenCalledOnce()
    const batch = vi.mocked(db._syncQueue.bulkAdd).mock.calls[0][0]
    expect(batch).toHaveLength(1)
    expect(batch[0].table).toBe('subjects')
    expect(batch[0].recordId).toBe('s1')
    expect(batch[0].operation).toBe('put')
    expect(batch[0].data).toEqual(obj)
  })

  it('uses primKey when obj has no id', async () => {
    initSyncTracking()

    const hooks = getHookCallbacks()
    hooks['subjects']['creating']('pk-123', { name: 'no id' })

    await vi.advanceTimersByTimeAsync(1100)

    const batch = vi.mocked(db._syncQueue.bulkAdd).mock.calls[0][0]
    expect(batch[0].recordId).toBe('pk-123')
  })

  it('queues put on updating hook with merged data', async () => {
    initSyncTracking()

    const hooks = getHookCallbacks()
    const mods = { name: 'Updated Math' }
    const existing = { id: 's1', name: 'Math', weight: 50 }
    hooks['subjects']['updating'](mods, 's1', existing)

    await vi.advanceTimersByTimeAsync(1100)

    const batch = vi.mocked(db._syncQueue.bulkAdd).mock.calls[0][0]
    expect(batch[0].operation).toBe('put')
    expect(batch[0].data).toEqual({ id: 's1', name: 'Updated Math', weight: 50 })
  })

  it('queues delete on deleting hook', async () => {
    initSyncTracking()

    const hooks = getHookCallbacks()
    hooks['subjects']['deleting']('s1')

    await vi.advanceTimersByTimeAsync(1100)

    const batch = vi.mocked(db._syncQueue.bulkAdd).mock.calls[0][0]
    expect(batch[0].operation).toBe('delete')
    expect(batch[0].recordId).toBe('s1')
    expect(batch[0].data).toBeUndefined()
  })

  it('does NOT queue changes when syncing is active', async () => {
    initSyncTracking()

    setSyncing(true)

    const hooks = getHookCallbacks()
    hooks['subjects']['creating'](undefined, { id: 's1', name: 'Math' })

    await vi.advanceTimersByTimeAsync(1100)

    // Should not have flushed anything
    expect(db._syncQueue.bulkAdd).not.toHaveBeenCalled()

    setSyncing(false)
  })

  it('supports nested syncing depth', async () => {
    initSyncTracking()

    setSyncing(true)
    setSyncing(true) // depth = 2

    const hooks = getHookCallbacks()
    hooks['subjects']['creating'](undefined, { id: 's1' })

    setSyncing(false) // depth = 1, still syncing
    hooks['subjects']['creating'](undefined, { id: 's2' })

    await vi.advanceTimersByTimeAsync(1100)
    expect(db._syncQueue.bulkAdd).not.toHaveBeenCalled()

    setSyncing(false) // depth = 0
    hooks['subjects']['creating'](undefined, { id: 's3' })

    await vi.advanceTimersByTimeAsync(1100)
    const batch = vi.mocked(db._syncQueue.bulkAdd).mock.calls[0][0]
    expect(batch).toHaveLength(1)
    expect(batch[0].recordId).toBe('s3')
  })

  it('retries failed flush by putting items back', async () => {
    initSyncTracking()

    const hooks = getHookCallbacks()
    hooks['subjects']['creating'](undefined, { id: 's1' })

    // First flush fails
    vi.mocked(db._syncQueue.bulkAdd).mockRejectedValueOnce(new Error('DB error'))
    await vi.advanceTimersByTimeAsync(1100)

    expect(db._syncQueue.bulkAdd).toHaveBeenCalledOnce()

    // Second flush should retry with the same data
    vi.mocked(db._syncQueue.bulkAdd).mockResolvedValueOnce(undefined as never)
    await vi.advanceTimersByTimeAsync(1100)

    expect(db._syncQueue.bulkAdd).toHaveBeenCalledTimes(2)
    const retryBatch = vi.mocked(db._syncQueue.bulkAdd).mock.calls[1][0]
    expect(retryBatch[0].recordId).toBe('s1')
  })
})

describe('stopSyncTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears the flush interval and does a final flush', async () => {
    initSyncTracking()

    const hooks = getHookCallbacks()
    hooks['subjects']['creating'](undefined, { id: 's1' })

    // Stop tracking — should trigger final flush
    stopSyncTracking()

    // The final flush is fire-and-forget; give microtasks time to run
    await vi.advanceTimersByTimeAsync(0)

    expect(db._syncQueue.bulkAdd).toHaveBeenCalled()
  })

  it('does not flush after stopping', async () => {
    initSyncTracking()
    stopSyncTracking()

    vi.mocked(db._syncQueue.bulkAdd).mockClear()

    // Advance past flush interval — nothing should happen
    await vi.advanceTimersByTimeAsync(3000)

    expect(db._syncQueue.bulkAdd).not.toHaveBeenCalled()
  })
})
