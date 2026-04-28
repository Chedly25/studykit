import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { db } from '../../../db'
import { rateFlashcard } from '../dataOperations'
import type { Flashcard, FlashcardDeck, Misconception } from '../../../db/schema'

/**
 * Integration test: rateFlashcard tightens the persisted interval when the
 * card's parent topic has fresh, unresolved, severe misconceptions. Quality=4
 * (the "you got it but I don't fully trust this topic" zone) — the only zone
 * where modulation kicks in.
 */

const PROFILE = 'p-1'
const TOPIC = 't-1'

async function seedCard(overrides: Partial<Flashcard> = {}): Promise<Flashcard> {
  // Park a deck so the cascade lookups don't fail downstream.
  const deck: FlashcardDeck = {
    id: 'd-1',
    examProfileId: PROFILE,
    topicId: TOPIC,
    name: 'Test deck',
    createdAt: new Date().toISOString(),
  }
  await db.flashcardDecks.put(deck)

  const card: Flashcard = {
    id: 'c-1',
    deckId: 'd-1',
    topicId: TOPIC,
    front: 'Q',
    back: 'A',
    source: 'manual',
    easeFactor: 2.5,
    interval: 20,
    repetitions: 3,
    nextReviewDate: new Date().toISOString().slice(0, 10),
    lastRating: 4,
    ...overrides,
  }
  await db.flashcards.put(card)
  return card
}

async function seedMisconception(overrides: Partial<Misconception> = {}): Promise<void> {
  const now = new Date().toISOString()
  await db.misconceptions.put({
    id: `m-${Math.random()}`,
    examProfileId: PROFILE,
    topicId: TOPIC,
    description: 'confuses faute lourde and faute simple',
    occurrenceCount: 1,
    severity: 5,
    firstSeenAt: now,
    lastSeenAt: now,
    exerciseIds: '[]',
    questionResultIds: '[]',
    ...overrides,
  })
}

beforeEach(async () => {
  // Close first, then swap factory, then reopen — order matters: a swap before
  // close leaves the connection bound to the old factory, so any subsequent
  // Dexie.delete operates on a different DB than what's about to be reopened.
  if (db.isOpen()) db.close()
  globalThis.indexedDB = new IDBFactory()
  await db.open()
  // Defensive: explicitly clear the tables we touch (the factory swap above
  // should be enough, but Dexie keeps internal caches that occasionally bleed
  // across tests in vitest's worker model).
  await Promise.all([
    db.flashcards.clear(),
    db.flashcardDecks.clear(),
    db.misconceptions.clear(),
  ])
})

describe('rateFlashcard with misconception modulation', () => {
  it('shortens the interval when topic has a fresh severe misconception (quality=4)', async () => {
    await seedCard({ interval: 20 })
    await seedMisconception({ severity: 5 })

    const result = JSON.parse(await rateFlashcard(PROFILE, { cardId: 'c-1', rating: 4 }))
    expect(result.success).toBe(true)
    expect(result.misconceptionTightened).toBe(true)
    // Without modulation: 20 * 2.5 = 50. With weight=1, multiplier=0.5 → 25.
    expect(result.newInterval).toBeLessThan(50)

    const persisted = await db.flashcards.get('c-1')
    expect(persisted?.interval).toBe(result.newInterval)
  })

  it('leaves interval unchanged at quality=5 even with a severe misconception', async () => {
    await seedCard({ interval: 20 })
    await seedMisconception({ severity: 5 })

    const result = JSON.parse(await rateFlashcard(PROFILE, { cardId: 'c-1', rating: 5 }))
    expect(result.misconceptionTightened).toBe(false)
    // SM-2 at q=5 with rep=3, interval=20, ef=2.5 → ef bumps slightly, interval = round(20 * ef) = 50ish
    expect(result.newInterval).toBeGreaterThan(40)
  })

  it('leaves interval unchanged when there is no misconception on the topic', async () => {
    await seedCard({ interval: 20 })

    const result = JSON.parse(await rateFlashcard(PROFILE, { cardId: 'c-1', rating: 4 }))
    expect(result.misconceptionTightened).toBe(false)
  })

  it('ignores resolved misconceptions', async () => {
    await seedCard({ interval: 20 })
    await seedMisconception({ severity: 5, resolvedAt: new Date().toISOString() })

    const result = JSON.parse(await rateFlashcard(PROFILE, { cardId: 'c-1', rating: 4 }))
    expect(result.misconceptionTightened).toBe(false)
  })

  it('returns an error when the card is not found', async () => {
    const result = JSON.parse(await rateFlashcard(PROFILE, { cardId: 'does-not-exist', rating: 4 }))
    expect(result.error).toMatch(/not found/i)
  })
})
