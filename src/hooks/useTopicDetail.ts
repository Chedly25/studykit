/**
 * Lazy per-topic data aggregation hook.
 * Only queries when topicId is non-null (topic is expanded).
 */
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Exercise, ExamSource, ConceptCard, MasterySnapshot } from '../db/schema'

export interface ExerciseGroup {
  source: ExamSource
  exercises: Exercise[]
}

export interface TopicDetail {
  exerciseGroups: ExerciseGroup[]
  flashcardStats: { total: number; due: number }
  conceptCards: ConceptCard[]
  documentSections: Array<{ documentTitle: string; chunkCount: number }>
  masteryTrend: MasterySnapshot[]
  isLoading: boolean
}

const EMPTY: TopicDetail = {
  exerciseGroups: [],
  flashcardStats: { total: 0, due: 0 },
  conceptCards: [],
  documentSections: [],
  masteryTrend: [],
  isLoading: false,
}

export function useTopicDetail(topicId: string | null, examProfileId: string | undefined): TopicDetail {
  const today = new Date().toISOString().slice(0, 10)

  const exercises = useLiveQuery(
    async () => {
      if (!topicId || !examProfileId) return []
      const all = await db.exercises.where('examProfileId').equals(examProfileId).toArray()
      return all.filter(ex => {
        if (ex.hidden) return false
        try {
          const ids: string[] = JSON.parse(ex.topicIds || '[]')
          return ids.includes(topicId)
        } catch { return false }
      })
    },
    [topicId, examProfileId],
  )

  const examSources = useLiveQuery(
    () => examProfileId
      ? db.examSources.where('examProfileId').equals(examProfileId).toArray()
      : [],
    [examProfileId],
  )

  const flashcards = useLiveQuery(
    async () => {
      if (!topicId) return { total: 0, due: 0 }
      const cards = await db.flashcards.where('topicId').equals(topicId).toArray()
      const due = cards.filter(c => c.nextReviewDate <= today).length
      return { total: cards.length, due }
    },
    [topicId, today],
  )

  const conceptCards = useLiveQuery(
    () => topicId && examProfileId
      ? db.conceptCards.where('[examProfileId+topicId]').equals([examProfileId, topicId]).toArray()
      : [],
    [topicId, examProfileId],
  )

  const documentSections = useLiveQuery(
    async () => {
      if (!topicId) return []
      const chunks = await db.documentChunks.where('topicId').equals(topicId).toArray()
      if (chunks.length === 0) return []
      const byDoc = new Map<string, number>()
      for (const c of chunks) byDoc.set(c.documentId, (byDoc.get(c.documentId) ?? 0) + 1)
      const docs = await db.documents.where('id').anyOf([...byDoc.keys()]).toArray()
      const docMap = new Map(docs.map(d => [d.id, d.title]))
      return [...byDoc.entries()].map(([docId, count]) => ({
        documentTitle: docMap.get(docId) ?? 'Unknown',
        chunkCount: count,
      }))
    },
    [topicId],
  )

  const masteryTrend = useLiveQuery(
    async () => {
      if (!topicId) return []
      const all = await db.masterySnapshots.where('topicId').equals(topicId).toArray()
      return all.sort((a, b) => a.date.localeCompare(b.date)).slice(-7)
    },
    [topicId],
  )

  const exerciseGroups = useMemo(() => {
    if (!exercises || !examSources) return []
    const sourceMap = new Map(examSources.map(s => [s.id, s]))
    const grouped = new Map<string, Exercise[]>()
    for (const ex of exercises) {
      if (!grouped.has(ex.examSourceId)) grouped.set(ex.examSourceId, [])
      grouped.get(ex.examSourceId)!.push(ex)
    }
    return [...grouped.entries()]
      .map(([sourceId, exs]) => ({
        source: sourceMap.get(sourceId)!,
        exercises: exs.sort((a, b) => a.exerciseNumber - b.exerciseNumber),
      }))
      .filter(g => g.source)
  }, [exercises, examSources])

  if (!topicId) return EMPTY

  const isLoading = exercises === undefined || examSources === undefined ||
    flashcards === undefined || conceptCards === undefined ||
    documentSections === undefined || masteryTrend === undefined

  return {
    exerciseGroups,
    flashcardStats: flashcards ?? { total: 0, due: 0 },
    conceptCards: conceptCards ?? [],
    documentSections: documentSections ?? [],
    masteryTrend: masteryTrend ?? [],
    isLoading,
  }
}
