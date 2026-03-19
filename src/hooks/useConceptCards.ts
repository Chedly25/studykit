import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ConceptCard, ConceptCardConnection } from '../db/schema'

export function useConceptCards(examProfileId: string | undefined, topicId?: string) {
  const cards = useLiveQuery(
    () => {
      if (!examProfileId) return []
      if (topicId) {
        return db.conceptCards
          .where('[examProfileId+topicId]')
          .equals([examProfileId, topicId])
          .sortBy('createdAt')
      }
      return db.conceptCards
        .where('examProfileId')
        .equals(examProfileId)
        .sortBy('createdAt')
    },
    [examProfileId, topicId],
    [],
  )

  const connections = useLiveQuery(
    () => examProfileId
      ? db.conceptCardConnections.where('examProfileId').equals(examProfileId).toArray()
      : [],
    [examProfileId],
    [],
  )

  const updateMastery = useCallback(async (cardId: string, mastery: number) => {
    await db.conceptCards.update(cardId, { mastery, updatedAt: new Date().toISOString() })
  }, [])

  return { cards, connections, updateMastery }
}
