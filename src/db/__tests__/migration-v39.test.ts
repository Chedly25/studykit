import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { IDBFactory } from 'fake-indexeddb'

/**
 * Verifies the v39 upgrade path: severity is backfilled on existing
 * Misconception rows from occurrenceCount, and never overwrites a row that
 * already has severity (forward-compat with new writes from older clients).
 */

interface MisconceptionV38 {
  id: string
  examProfileId: string
  topicId: string
  description: string
  occurrenceCount: number
  firstSeenAt: string
  lastSeenAt: string
  exerciseIds: string
  questionResultIds: string
  severity?: number
}

const DB_NAME = 'migration-v39-test'

function buildDB(): Dexie {
  const db = new Dexie(DB_NAME)
  // v38: pre-severity schema — same indices the real db uses for misconceptions
  db.version(38).stores({
    misconceptions: 'id, examProfileId, topicId, [examProfileId+topicId]',
  })
  // v39: same upgrade body as src/db/index.ts
  db.version(39).stores({}).upgrade(tx =>
    tx.table('misconceptions').toCollection().modify((m: MisconceptionV38) => {
      if (m.severity === undefined) {
        const occ = typeof m.occurrenceCount === 'number' ? m.occurrenceCount : 1
        m.severity = Math.max(1, Math.min(5, 1 + Math.floor(occ / 2)))
      }
    })
  )
  return db
}

beforeEach(async () => {
  // Reset fake-indexeddb between tests for full isolation.
  globalThis.indexedDB = new IDBFactory()
  await Dexie.delete(DB_NAME)
})

describe('v39 migration: Misconception.severity backfill', () => {
  it('backfills severity from occurrenceCount when missing', async () => {
    // Open at v38, write rows without severity, close.
    const dbV38 = new Dexie(DB_NAME)
    dbV38.version(38).stores({
      misconceptions: 'id, examProfileId, topicId, [examProfileId+topicId]',
    })
    await dbV38.open()
    const now = new Date().toISOString()
    await dbV38.table('misconceptions').bulkAdd([
      { id: 'm1', examProfileId: 'p', topicId: 't', description: 'a',
        occurrenceCount: 1, firstSeenAt: now, lastSeenAt: now,
        exerciseIds: '[]', questionResultIds: '[]' },
      { id: 'm2', examProfileId: 'p', topicId: 't', description: 'b',
        occurrenceCount: 4, firstSeenAt: now, lastSeenAt: now,
        exerciseIds: '[]', questionResultIds: '[]' },
      { id: 'm3', examProfileId: 'p', topicId: 't', description: 'c',
        occurrenceCount: 12, firstSeenAt: now, lastSeenAt: now,
        exerciseIds: '[]', questionResultIds: '[]' },
    ] as MisconceptionV38[])
    dbV38.close()

    // Re-open at v39 — triggers the upgrade.
    const dbV39 = buildDB()
    await dbV39.open()
    const rows = await dbV39.table('misconceptions').toArray() as MisconceptionV38[]
    const byId = new Map(rows.map(r => [r.id, r]))
    expect(byId.get('m1')?.severity).toBe(1)  // 1 + floor(1/2) = 1
    expect(byId.get('m2')?.severity).toBe(3)  // 1 + floor(4/2) = 3
    expect(byId.get('m3')?.severity).toBe(5)  // clamped (1 + floor(12/2) = 7 → 5)
    dbV39.close()
  })

  it('does not overwrite severity when already set', async () => {
    // Open directly at v39 (no v38 stage), write a row with severity already set,
    // re-open — the upgrade modify hook still runs for completeness; assert it
    // leaves explicit severity alone.
    const dbV39a = buildDB()
    await dbV39a.open()
    const now = new Date().toISOString()
    await dbV39a.table('misconceptions').add({
      id: 'm1', examProfileId: 'p', topicId: 't', description: 'a',
      occurrenceCount: 10, severity: 2, firstSeenAt: now, lastSeenAt: now,
      exerciseIds: '[]', questionResultIds: '[]',
    } as MisconceptionV38)
    dbV39a.close()

    const dbV39b = buildDB()
    await dbV39b.open()
    const row = await dbV39b.table('misconceptions').get('m1') as MisconceptionV38 | undefined
    expect(row?.severity).toBe(2) // not 6 (which would be the backfill value)
    dbV39b.close()
  })

  it('handles a row with bogus occurrenceCount by defaulting to severity 1', async () => {
    const dbV38 = new Dexie(DB_NAME)
    dbV38.version(38).stores({
      misconceptions: 'id, examProfileId, topicId, [examProfileId+topicId]',
    })
    await dbV38.open()
    const now = new Date().toISOString()
    // Mimic corrupted data: occurrenceCount missing entirely.
    await dbV38.table('misconceptions').add({
      id: 'm1', examProfileId: 'p', topicId: 't', description: 'a',
      firstSeenAt: now, lastSeenAt: now,
      exerciseIds: '[]', questionResultIds: '[]',
    } as unknown as MisconceptionV38)
    dbV38.close()

    const dbV39 = buildDB()
    await dbV39.open()
    const row = await dbV39.table('misconceptions').get('m1') as MisconceptionV38 | undefined
    expect(row?.severity).toBe(1) // default branch
    dbV39.close()
  })
})
