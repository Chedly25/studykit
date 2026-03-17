import { useCallback, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { FlashcardDeck, Flashcard } from '../db/schema'
import { calculateSM2 } from '../lib/spacedRepetition'
import { recomputeTopicMastery, advanceTopicSRS } from '../lib/topicMastery'

const LEGACY_KEY = 'studieskit-smart-flashcards'

export function useFlashcards(examProfileId: string | undefined) {
  // ─── Reactive queries ──────────────────────────────────────────
  const decksRaw = useLiveQuery(
    () => {
      if (examProfileId) {
        // Profile active: decks belonging to this profile + standalone decks (no profile)
        return db.flashcardDecks.toArray().then(all =>
          all.filter(d => d.examProfileId === examProfileId || !d.examProfileId)
        )
      }
      // No profile: all decks
      return db.flashcardDecks.toArray()
    },
    [examProfileId]
  )
  const decks = decksRaw ?? []
  const isLoading = decksRaw === undefined

  const deckIds = decks.map(d => d.id)

  const cardsRaw = useLiveQuery(
    () => deckIds.length > 0
      ? db.flashcards.where('deckId').anyOf(deckIds).toArray()
      : Promise.resolve([] as Flashcard[]),
    [deckIds.join(',')]
  )
  const cards = cardsRaw ?? []

  // ─── Helpers ───────────────────────────────────────────────────
  const getCardsForDeck = useCallback(
    (deckId: string) => cards.filter(c => c.deckId === deckId),
    [cards]
  )

  const getDueCount = useCallback(
    (deckId: string) => {
      const today = new Date().toISOString().slice(0, 10)
      return cards.filter(c => c.deckId === deckId && c.nextReviewDate <= today).length
    },
    [cards]
  )

  const getStatsForDeck = useCallback(
    (deckId: string) => {
      const deckCards = cards.filter(c => c.deckId === deckId)
      const today = new Date().toISOString().slice(0, 10)
      const dueToday = deckCards.filter(c => c.nextReviewDate <= today).length
      const mastered = deckCards.filter(c => c.repetitions >= 3 && c.easeFactor >= 2.0).length
      const avgEase = deckCards.length > 0
        ? deckCards.reduce((sum, c) => sum + c.easeFactor, 0) / deckCards.length
        : 0

      const upcoming: { date: string; count: number }[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date()
        d.setDate(d.getDate() + i)
        const dateStr = d.toISOString().slice(0, 10)
        const count = deckCards.filter(c => c.nextReviewDate === dateStr).length
        upcoming.push({ date: dateStr, count })
      }

      return { dueToday, mastered, total: deckCards.length, avgEase, upcoming }
    },
    [cards]
  )

  // ─── Mutations ─────────────────────────────────────────────────
  const createDeck = useCallback(async (name: string) => {
    await db.flashcardDecks.put({
      id: crypto.randomUUID(),
      name,
      examProfileId: examProfileId || undefined,
      createdAt: new Date().toISOString(),
    })
  }, [examProfileId])

  const deleteDeck = useCallback(async (deckId: string) => {
    await db.transaction('rw', db.flashcards, db.flashcardDecks, async () => {
      await db.flashcards.where('deckId').equals(deckId).delete()
      await db.flashcardDecks.delete(deckId)
    })
  }, [])

  const addCard = useCallback(async (deckId: string, front: string, back: string) => {
    const today = new Date().toISOString().slice(0, 10)
    await db.flashcards.put({
      id: crypto.randomUUID(),
      deckId,
      front,
      back,
      source: 'manual',
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReviewDate: today,
      lastRating: 0,
    })
  }, [])

  const removeCard = useCallback(async (cardId: string) => {
    await db.flashcards.delete(cardId)
  }, [])

  const rateCard = useCallback(async (cardId: string, quality: number) => {
    const card = await db.flashcards.get(cardId)
    if (!card) return
    const result = calculateSM2(quality, {
      id: card.id,
      front: card.front,
      back: card.back,
      easeFactor: card.easeFactor,
      interval: card.interval,
      repetitions: card.repetitions,
      nextReviewDate: card.nextReviewDate,
      lastRating: card.lastRating,
    })
    await db.flashcards.update(cardId, {
      easeFactor: result.easeFactor,
      interval: result.interval,
      repetitions: result.repetitions,
      nextReviewDate: result.nextReviewDate,
      lastRating: quality,
    })

    // Update topic mastery and advance topic SRS if card has a topicId
    if (card.topicId) {
      await recomputeTopicMastery(card.topicId)
      await advanceTopicSRS(card.topicId, quality)
    }
  }, [])

  const importDeck = useCallback(async (file: File) => {
    const text = await file.text()
    let deckName: string
    let parsedCards: Array<{ front: string; back: string; easeFactor?: number; interval?: number; repetitions?: number; nextReviewDate?: string; lastRating?: number }>

    try {
      const parsed = JSON.parse(text)
      if (parsed.name && Array.isArray(parsed.cards)) {
        deckName = parsed.name
        parsedCards = parsed.cards.map((c: Record<string, unknown>) => ({
          front: String(c.front ?? ''),
          back: String(c.back ?? ''),
          ...(c.easeFactor !== undefined ? {
            easeFactor: Number(c.easeFactor) || 2.5,
            interval: Number(c.interval) || 0,
            repetitions: Number(c.repetitions) || 0,
            nextReviewDate: typeof c.nextReviewDate === 'string' ? c.nextReviewDate : new Date().toISOString().slice(0, 10),
            lastRating: Number(c.lastRating) || 0,
          } : {}),
        }))
      } else {
        return
      }
    } catch {
      // Try CSV
      const lines = text.trim().split('\n').filter(l => l.includes(','))
      if (lines.length === 0) return
      deckName = file.name.replace(/\.[^.]+$/, '')
      parsedCards = lines.map(line => {
        const [front, ...rest] = line.split(',')
        return { front: front.trim(), back: rest.join(',').trim() }
      })
    }

    const deckId = crypto.randomUUID()
    const today = new Date().toISOString().slice(0, 10)

    await db.transaction('rw', db.flashcardDecks, db.flashcards, async () => {
      await db.flashcardDecks.put({
        id: deckId,
        name: deckName,
        examProfileId: examProfileId || undefined,
        createdAt: new Date().toISOString(),
      })

      const flashcards: Flashcard[] = parsedCards.map(c => ({
        id: crypto.randomUUID(),
        deckId,
        front: c.front,
        back: c.back,
        source: 'imported' as const,
        easeFactor: c.easeFactor ?? 2.5,
        interval: c.interval ?? 0,
        repetitions: c.repetitions ?? 0,
        nextReviewDate: c.nextReviewDate ?? today,
        lastRating: c.lastRating ?? 0,
      }))

      await db.flashcards.bulkPut(flashcards)
    })
  }, [examProfileId])

  const exportDeck = useCallback(async (deckId: string) => {
    const deck = await db.flashcardDecks.get(deckId)
    if (!deck) return
    const deckCards = await db.flashcards.where('deckId').equals(deckId).toArray()

    const exportData = {
      id: deck.id,
      name: deck.name,
      cards: deckCards.map(c => ({
        id: c.id,
        front: c.front,
        back: c.back,
        easeFactor: c.easeFactor,
        interval: c.interval,
        repetitions: c.repetitions,
        nextReviewDate: c.nextReviewDate,
        lastRating: c.lastRating,
      })),
    }

    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deck.name.replace(/\s+/g, '-').toLowerCase()}-flashcards.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  // ─── Safety-net migration on mount ─────────────────────────────
  const migrated = useRef(false)
  useEffect(() => {
    if (migrated.current) return
    migrated.current = true

    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return

    interface LegacyCard {
      id: string; front: string; back: string
      easeFactor: number; interval: number; repetitions: number
      nextReviewDate: string; lastRating: number
    }
    interface LegacyDeck { id: string; name: string; cards: LegacyCard[] }

    try {
      const legacyDecks: LegacyDeck[] = JSON.parse(raw)
      if (!Array.isArray(legacyDecks) || legacyDecks.length === 0) {
        localStorage.removeItem(LEGACY_KEY)
        return
      }

      ;(async () => {
        const existingIds = new Set(
          await db.flashcardDecks.where('id').anyOf(legacyDecks.map(d => d.id)).primaryKeys()
        )

        const newDecks: FlashcardDeck[] = []
        const newCards: Flashcard[] = []

        for (const ld of legacyDecks) {
          if (existingIds.has(ld.id)) continue
          newDecks.push({ id: ld.id, name: ld.name, createdAt: new Date().toISOString() })
          for (const lc of ld.cards) {
            newCards.push({
              id: lc.id, deckId: ld.id, front: lc.front, back: lc.back,
              source: 'manual', easeFactor: lc.easeFactor, interval: lc.interval,
              repetitions: lc.repetitions, nextReviewDate: lc.nextReviewDate, lastRating: lc.lastRating,
            })
          }
        }

        if (newDecks.length > 0) {
          await db.flashcardDecks.bulkPut(newDecks)
          await db.flashcards.bulkPut(newCards)
        }

        localStorage.removeItem(LEGACY_KEY)
      })()
    } catch {
      localStorage.removeItem(LEGACY_KEY)
    }
  }, [])

  return {
    decks,
    cards,
    isLoading,
    getCardsForDeck,
    getDueCount,
    getStatsForDeck,
    createDeck,
    deleteDeck,
    addCard,
    removeCard,
    rateCard,
    importDeck,
    exportDeck,
  }
}
