import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db module
vi.mock('../../db', () => ({
  db: {
    _syncQueue: {
      toArray: vi.fn().mockResolvedValue([]),
      bulkDelete: vi.fn().mockResolvedValue(undefined),
    },
    _syncMeta: {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
    },
    transaction: vi.fn(async (_mode: string, ..._tables: unknown[]) => {
      // Last argument is the callback
      const cb = _tables[_tables.length - 1] as () => Promise<void>
      return cb()
    }),
    // Dynamic table access for pullDelta
    subjects: { put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) },
    topics: { put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) },
    documents: { put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) },
  },
}))

// Mock syncTracking
vi.mock('../../db/syncTracking', () => ({
  setSyncing: vi.fn(),
}))

import { pushDelta, pullDelta } from '../incrementalSync'
import { db } from '../../db'
import { setSyncing } from '../../db/syncTracking'

// ─── Helpers ──────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── pushDelta ──────────────────────────────────────────────────

describe('pushDelta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns success with 0 changes when queue is empty', async () => {
    vi.mocked(db._syncQueue.toArray).mockResolvedValue([])

    const result = await pushDelta('p1', 'token')

    expect(result).toEqual({ success: true, changesStored: 0 })
  })

  it('deduplicates entries keeping latest timestamp', async () => {
    vi.mocked(db._syncQueue.toArray).mockResolvedValue([
      { id: 1, table: 'subjects', recordId: 's1', operation: 'put' as const, data: { name: 'v1' }, timestamp: '2024-01-01T00:00:00Z' },
      { id: 2, table: 'subjects', recordId: 's1', operation: 'put' as const, data: { name: 'v2' }, timestamp: '2024-01-01T01:00:00Z' },
      { id: 3, table: 'topics', recordId: 't1', operation: 'delete' as const, timestamp: '2024-01-01T00:30:00Z' },
    ])

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await pushDelta('p1', 'token')

    expect(result.success).toBe(true)
    expect(result.changesStored).toBe(2) // s1 (deduped) + t1

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const subjectChange = body.changes.find((c: { table: string }) => c.table === 'subjects')
    expect(subjectChange.data.name).toBe('v2') // Latest version
  })

  it('sends changes to /api/sync-push with auth header', async () => {
    vi.mocked(db._syncQueue.toArray).mockResolvedValue([
      { id: 1, table: 'subjects', recordId: 's1', operation: 'put' as const, data: { id: 's1' }, timestamp: '2024-01-01T00:00:00Z' },
    ])

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }))
    vi.stubGlobal('fetch', fetchMock)

    await pushDelta('p1', 'my-auth-token')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/sync-push')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Authorization']).toBe('Bearer my-auth-token')

    const body = JSON.parse(opts.body)
    expect(body.profileId).toBe('p1')
    expect(body.changes).toHaveLength(1)
    expect(body.clientTimestamp).toBeDefined()
  })

  it('clears queue and updates metadata on success', async () => {
    vi.mocked(db._syncQueue.toArray).mockResolvedValue([
      { id: 1, table: 'subjects', recordId: 's1', operation: 'put' as const, data: {}, timestamp: '2024-01-01T00:00:00Z' },
    ])
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true })))

    await pushDelta('p1', 'token')

    expect(db._syncQueue.bulkDelete).toHaveBeenCalledWith([1])
    expect(db._syncMeta.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
    )
  })

  it('returns error on API failure', async () => {
    vi.mocked(db._syncQueue.toArray).mockResolvedValue([
      { id: 1, table: 'subjects', recordId: 's1', operation: 'put' as const, data: {}, timestamp: '2024-01-01T00:00:00Z' },
    ])

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ error: 'Server error' }, 500),
    ))

    const result = await pushDelta('p1', 'token')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Server error')
  })

  it('returns error on network failure', async () => {
    vi.mocked(db._syncQueue.toArray).mockResolvedValue([
      { id: 1, table: 'subjects', recordId: 's1', operation: 'put' as const, data: {}, timestamp: '2024-01-01T00:00:00Z' },
    ])

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const result = await pushDelta('p1', 'token')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
  })

  it('handles non-JSON error response from API', async () => {
    vi.mocked(db._syncQueue.toArray).mockResolvedValue([
      { id: 1, table: 'subjects', recordId: 's1', operation: 'put' as const, data: {}, timestamp: '2024-01-01T00:00:00Z' },
    ])

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Bad Gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } }),
    ))

    const result = await pushDelta('p1', 'token')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Push failed')
  })

  it('filters out null ids when clearing queue', async () => {
    vi.mocked(db._syncQueue.toArray).mockResolvedValue([
      { id: 1, table: 'subjects', recordId: 's1', operation: 'put' as const, data: {}, timestamp: '2024-01-01T00:00:00Z' },
      { id: undefined, table: 'topics', recordId: 't1', operation: 'put' as const, data: {}, timestamp: '2024-01-01T00:00:00Z' },
    ])

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true })))

    await pushDelta('p1', 'token')

    expect(db._syncQueue.bulkDelete).toHaveBeenCalledWith([1])
  })
})

// ─── pullDelta ──────────────────────────────────────────────────

describe('pullDelta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches changes since lastPulledAt', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue({
      id: 'p1',
      lastPushedAt: '2024-01-01',
      lastPulledAt: '2024-06-01T00:00:00Z',
      lastSnapshotAt: '',
    })

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ changes: [], serverTimestamp: '2024-06-02T00:00:00Z' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await pullDelta('p1', 'token')

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('profileId=p1')
    expect(url).toContain('since=2024-06-01T00%3A00%3A00Z')
    expect(fetchMock.mock.calls[0][1].headers['Authorization']).toBe('Bearer token')
  })

  it('uses epoch when no lastPulledAt exists', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ changes: [], serverTimestamp: '2024-06-02T00:00:00Z' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await pullDelta('p1', 'token')

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('since=1970-01-01T00%3A00%3A00Z')
  })

  it('updates lastPulledAt even when no changes returned', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ changes: [], serverTimestamp: '2024-06-02T12:00:00Z' }),
    ))

    const result = await pullDelta('p1', 'token')

    expect(result).toEqual({ success: true, changesApplied: 0 })
    expect(db._syncMeta.put).toHaveBeenCalledWith(
      expect.objectContaining({ lastPulledAt: '2024-06-02T12:00:00Z' }),
    )
  })

  it('applies put changes to local DB', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({
        changes: [
          { table: 'subjects', recordId: 's1', operation: 'put', data: { id: 's1', examProfileId: 'p1', name: 'Math' }, timestamp: '2024-06-02T00:00:00Z' },
        ],
        serverTimestamp: '2024-06-02T12:00:00Z',
      }),
    ))

    const result = await pullDelta('p1', 'token')

    expect(result.success).toBe(true)
    expect(result.changesApplied).toBe(1)
    expect((db as unknown as Record<string, { put: (...args: unknown[]) => unknown }>).subjects.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', name: 'Math' }),
    )
  })

  it('applies delete changes to local DB', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({
        changes: [
          { table: 'subjects', recordId: 's1', operation: 'delete', timestamp: '2024-06-02T00:00:00Z' },
        ],
        serverTimestamp: '2024-06-02T12:00:00Z',
      }),
    ))

    const result = await pullDelta('p1', 'token')

    expect(result.success).toBe(true)
    expect(result.changesApplied).toBe(1)
    expect((db as unknown as Record<string, { delete: (...args: unknown[]) => unknown }>).subjects.delete).toHaveBeenCalledWith('s1')
  })

  it('skips changes for non-whitelisted tables', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({
        changes: [
          { table: 'documentFiles', recordId: 'f1', operation: 'put', data: { id: 'f1' }, timestamp: '2024-06-02T00:00:00Z' },
        ],
        serverTimestamp: '2024-06-02T12:00:00Z',
      }),
    ))

    const result = await pullDelta('p1', 'token')

    expect(result.changesApplied).toBe(0)
  })

  it('skips changes with wrong examProfileId (ownership check)', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({
        changes: [
          { table: 'subjects', recordId: 's1', operation: 'put', data: { id: 's1', examProfileId: 'other-profile', name: 'Hacked' }, timestamp: '2024-06-02T00:00:00Z' },
        ],
        serverTimestamp: '2024-06-02T12:00:00Z',
      }),
    ))

    const result = await pullDelta('p1', 'token')

    expect(result.changesApplied).toBe(0)
    expect((db as unknown as Record<string, { put: (...args: unknown[]) => unknown }>).subjects.put).not.toHaveBeenCalled()
  })

  it('enables and disables syncing flag during pull', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({
        changes: [
          { table: 'subjects', recordId: 's1', operation: 'put', data: { id: 's1', examProfileId: 'p1' }, timestamp: '2024-06-02T00:00:00Z' },
        ],
        serverTimestamp: '2024-06-02T12:00:00Z',
      }),
    ))

    await pullDelta('p1', 'token')

    expect(setSyncing).toHaveBeenCalledWith(true)
    expect(setSyncing).toHaveBeenCalledWith(false)
  })

  it('returns error on API failure', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ error: 'Unauthorized' }, 401),
    ))

    const result = await pullDelta('p1', 'token')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unauthorized')
  })

  it('returns error on network failure and resets syncing', async () => {
    vi.mocked(db._syncMeta.get).mockRejectedValue(new Error('DB unreachable'))

    const result = await pullDelta('p1', 'token')

    expect(result.success).toBe(false)
    expect(result.error).toBe('DB unreachable')
    expect(setSyncing).toHaveBeenCalledWith(false)
  })

  it('handles non-JSON error response', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Bad Gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } }),
    ))

    const result = await pullDelta('p1', 'token')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Pull failed')
  })

  it('skips individual record errors gracefully', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    // First put throws, second succeeds
    const subjectsPut = vi.fn()
      .mockRejectedValueOnce(new Error('Schema mismatch'))
      .mockResolvedValueOnce(undefined)
    ;(db as unknown as Record<string, { put: (...args: unknown[]) => unknown; delete: (...args: unknown[]) => unknown }>).subjects.put = subjectsPut

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({
        changes: [
          { table: 'subjects', recordId: 's1', operation: 'put', data: { id: 's1', examProfileId: 'p1' }, timestamp: '2024-06-02T00:00:00Z' },
          { table: 'subjects', recordId: 's2', operation: 'put', data: { id: 's2', examProfileId: 'p1' }, timestamp: '2024-06-02T00:01:00Z' },
        ],
        serverTimestamp: '2024-06-02T12:00:00Z',
      }),
    ))

    const result = await pullDelta('p1', 'token')

    // Only s2 should have succeeded
    expect(result.success).toBe(true)
    expect(result.changesApplied).toBe(1)
  })

  it('skips changes for tables not present on db object', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({
        changes: [
          // 'flashcards' is in SYNCABLE_TABLES but not mocked on db
          { table: 'flashcards', recordId: 'f1', operation: 'put', data: { id: 'f1', examProfileId: 'p1' }, timestamp: '2024-06-02T00:00:00Z' },
        ],
        serverTimestamp: '2024-06-02T12:00:00Z',
      }),
    ))

    const result = await pullDelta('p1', 'token')

    // Should skip because db.flashcards doesn't exist in our mock
    expect(result.changesApplied).toBe(0)
  })

  it('skips put operation when data is missing', async () => {
    vi.mocked(db._syncMeta.get).mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({
        changes: [
          { table: 'subjects', recordId: 's1', operation: 'put', timestamp: '2024-06-02T00:00:00Z' },
        ],
        serverTimestamp: '2024-06-02T12:00:00Z',
      }),
    ))

    const result = await pullDelta('p1', 'token')

    expect(result.changesApplied).toBe(0)
  })
})
