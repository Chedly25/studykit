import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { db } from '../../../db'
import { markOpened, markRead, markUnread, getStatus, getAllStatuses, updateScrollPercent } from '../readStatus'

const PROFILE = 'p-1'
const ENTRY = 'gajc-blanco-1873'

beforeEach(async () => {
  if (db.isOpen()) db.close()
  globalThis.indexedDB = new IDBFactory()
  await db.open()
  await db.libraryReadStatus.clear()
})

describe('library readStatus', () => {
  it('markOpened creates a row with status=reading', async () => {
    await markOpened(PROFILE, ENTRY)
    const row = await getStatus(PROFILE, ENTRY)
    expect(row?.status).toBe('reading')
    expect(row?.lastOpenedAt).toBeTruthy()
  })

  it('markOpened on a row already marked read does NOT downgrade status', async () => {
    await markRead(PROFILE, ENTRY)
    await markOpened(PROFILE, ENTRY) // re-open after read
    const row = await getStatus(PROFILE, ENTRY)
    expect(row?.status).toBe('read')
  })

  it('markRead sets status=read and scrollPercent=100', async () => {
    await markRead(PROFILE, ENTRY)
    const row = await getStatus(PROFILE, ENTRY)
    expect(row?.status).toBe('read')
    expect(row?.scrollPercent).toBe(100)
  })

  it('markUnread deletes the row', async () => {
    await markRead(PROFILE, ENTRY)
    await markUnread(PROFILE, ENTRY)
    const row = await getStatus(PROFILE, ENTRY)
    expect(row).toBeNull()
  })

  it('markUnread on a non-existent row is a no-op', async () => {
    await markUnread(PROFILE, 'never-touched')
    const row = await getStatus(PROFILE, 'never-touched')
    expect(row).toBeNull()
  })

  it('updateScrollPercent clamps to 0..100 and creates a row if missing', async () => {
    await updateScrollPercent(PROFILE, ENTRY, 47.4)
    const row = await getStatus(PROFILE, ENTRY)
    expect(row?.scrollPercent).toBe(47)

    await updateScrollPercent(PROFILE, ENTRY, 9999)
    const row2 = await getStatus(PROFILE, ENTRY)
    expect(row2?.scrollPercent).toBe(100)

    await updateScrollPercent(PROFILE, ENTRY, -50)
    const row3 = await getStatus(PROFILE, ENTRY)
    expect(row3?.scrollPercent).toBe(0)
  })

  it('getAllStatuses returns only rows for the given profile', async () => {
    await markOpened('profile-A', 'entry-1')
    await markOpened('profile-A', 'entry-2')
    await markOpened('profile-B', 'entry-1')
    const aRows = await getAllStatuses('profile-A')
    expect(aRows.length).toBe(2)
    expect(aRows.every(r => r.examProfileId === 'profile-A')).toBe(true)
  })
})
