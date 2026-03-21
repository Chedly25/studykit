/**
 * Batch-query hook returning content counts per topic for a profile.
 * Single useLiveQuery with 4 parallel queries — avoids N+1.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export interface TopicContentStats {
  docs: number
  exercises: number
  flashcards: number
  cards: number
  dueFlashcards: number
}

const EMPTY_MAP = new Map<string, TopicContentStats>()

export function useTopicStats(examProfileId: string | undefined): Map<string, TopicContentStats> {
  const result = useLiveQuery(
    async () => {
      if (!examProfileId) return EMPTY_MAP

      const today = new Date().toISOString().slice(0, 10)

      const [chunks, exercises, decks, conceptCards] = await Promise.all([
        db.documentChunks.where('examProfileId').equals(examProfileId).toArray(),
        db.exercises.where('examProfileId').equals(examProfileId).toArray(),
        db.flashcardDecks.where('examProfileId').equals(examProfileId).toArray(),
        db.conceptCards.where('examProfileId').equals(examProfileId).toArray(),
      ])

      // Get flashcards via deck IDs
      const deckIds = decks.map(d => d.id)
      const flashcards = deckIds.length > 0
        ? await db.flashcards.where('deckId').anyOf(deckIds).toArray()
        : []

      const map = new Map<string, TopicContentStats>()

      const getOrCreate = (topicId: string): TopicContentStats => {
        let stats = map.get(topicId)
        if (!stats) {
          stats = { docs: 0, exercises: 0, flashcards: 0, cards: 0, dueFlashcards: 0 }
          map.set(topicId, stats)
        }
        return stats
      }

      // 1. Document chunks → count unique documents per topic
      const docsByTopic = new Map<string, Set<string>>()
      for (const chunk of chunks) {
        if (!chunk.topicId) continue
        let docSet = docsByTopic.get(chunk.topicId)
        if (!docSet) {
          docSet = new Set()
          docsByTopic.set(chunk.topicId, docSet)
        }
        docSet.add(chunk.documentId)
      }
      for (const [topicId, docSet] of docsByTopic) {
        getOrCreate(topicId).docs = docSet.size
      }

      // 2. Exercises → parse topicIds JSON
      for (const ex of exercises) {
        if (ex.hidden) continue
        try {
          const topicIds: string[] = JSON.parse(ex.topicIds || '[]')
          for (const tid of topicIds) {
            getOrCreate(tid).exercises++
          }
        } catch { /* skip */ }
      }

      // 3. Flashcards → count by topicId + due
      for (const card of flashcards) {
        if (!card.topicId) continue
        const stats = getOrCreate(card.topicId)
        stats.flashcards++
        if (card.nextReviewDate <= today) {
          stats.dueFlashcards++
        }
      }

      // 4. Concept cards → count by topicId
      for (const card of conceptCards) {
        getOrCreate(card.topicId).cards++
      }

      return map
    },
    [examProfileId],
  )

  return result ?? EMPTY_MAP
}
