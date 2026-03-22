/**
 * Combined semantic + local search across all content types.
 * Documents use vector search (embeddings), everything else uses keyword matching.
 */
import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { db } from '../db'
import { hybridSearch } from '../lib/hybridSearch'

export interface SearchResult {
  type: 'document' | 'topic' | 'exercise' | 'concept-card' | 'flashcard'
  id: string
  title: string
  snippet: string
  score: number
  linkTo: string
  metadata?: { subject?: string; difficulty?: number; mastery?: number }
}

export function useSearch(examProfileId: string | undefined) {
  const { getToken } = useAuth()
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const abortRef = useRef(0)

  const search = useCallback(async (query: string) => {
    if (!examProfileId || !query.trim()) {
      setResults([])
      return
    }

    const searchId = ++abortRef.current
    setIsSearching(true)
    const queryLower = query.toLowerCase()

    try {
      // Run all searches in parallel
      const [docResults, topicResults, exerciseResults, conceptResults, flashcardResults] = await Promise.all([
        // 1. Semantic search over documents
        (async (): Promise<SearchResult[]> => {
          try {
            const token = await getToken() ?? undefined
            const chunks = await hybridSearch(examProfileId, query, token, { topN: 8 })
            return chunks.map(c => ({
              type: 'document' as const,
              id: c.id,
              title: c.documentTitle ?? 'Document',
              snippet: c.content.slice(0, 150) + (c.content.length > 150 ? '...' : ''),
              score: c.score,
              linkTo: '/sources',
            }))
          } catch {
            return []
          }
        })(),

        // 2. Topics (keyword search)
        (async (): Promise<SearchResult[]> => {
          const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
          const subjects = await db.subjects.where('examProfileId').equals(examProfileId).toArray()
          const subjectMap = new Map(subjects.map(s => [s.id, s.name]))
          return topics
            .filter(t => t.name.toLowerCase().includes(queryLower))
            .map(t => ({
              type: 'topic' as const,
              id: t.id,
              title: t.name,
              snippet: subjectMap.get(t.subjectId) ?? '',
              score: t.name.toLowerCase() === queryLower ? 0.95 : 0.6,
              linkTo: `/session?topic=${encodeURIComponent(t.name)}`,
              metadata: { subject: subjectMap.get(t.subjectId), mastery: t.mastery },
            }))
        })(),

        // 3. Exercises (keyword search)
        (async (): Promise<SearchResult[]> => {
          const exercises = await db.exercises.where('examProfileId').equals(examProfileId).toArray()
          return exercises
            .filter(e => e.text.toLowerCase().includes(queryLower))
            .slice(0, 5)
            .map(e => ({
              type: 'exercise' as const,
              id: e.id,
              title: `Exercise ${e.exerciseNumber}`,
              snippet: e.text.slice(0, 150) + (e.text.length > 150 ? '...' : ''),
              score: 0.5,
              linkTo: '/exercises',
              metadata: { difficulty: e.difficulty },
            }))
        })(),

        // 4. Concept cards (keyword search)
        (async (): Promise<SearchResult[]> => {
          const cards = await db.conceptCards.where('examProfileId').equals(examProfileId).toArray()
          const allTopics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
          const topicNameMap = new Map(allTopics.map(t => [t.id, t.name]))
          return cards
            .filter(c => c.title.toLowerCase().includes(queryLower))
            .slice(0, 5)
            .map(c => ({
              type: 'concept-card' as const,
              id: c.id,
              title: c.title,
              snippet: c.example?.slice(0, 100) ?? '',
              score: 0.55,
              linkTo: `/session?topic=${encodeURIComponent(topicNameMap.get(c.topicId) ?? c.title)}`,
            }))
        })(),

        // 5. Flashcards (keyword search, scoped to profile decks)
        (async (): Promise<SearchResult[]> => {
          const profileDecks = await db.flashcardDecks.where('examProfileId').equals(examProfileId).toArray()
          const profileDeckIds = new Set(profileDecks.map(d => d.id))
          const flashcards = await db.flashcards.toArray()
          return flashcards
            .filter(f => profileDeckIds.has(f.deckId) && (f.front.toLowerCase().includes(queryLower) || f.back.toLowerCase().includes(queryLower)))
            .slice(0, 5)
            .map(f => ({
              type: 'flashcard' as const,
              id: f.id,
              title: f.front.slice(0, 80),
              snippet: f.back.slice(0, 100),
              score: 0.45,
              linkTo: '/flashcard-maker',
            }))
        })(),
      ])

      // Check if this search is still current
      if (searchId !== abortRef.current) return

      // Merge and sort by score
      const all = [...docResults, ...topicResults, ...exerciseResults, ...conceptResults, ...flashcardResults]
      all.sort((a, b) => b.score - a.score)

      setResults(all.slice(0, 20))
    } finally {
      if (searchId === abortRef.current) {
        setIsSearching(false)
      }
    }
  }, [examProfileId, getToken])

  const clear = useCallback(() => {
    abortRef.current++
    setResults([])
    setIsSearching(false)
  }, [])

  return { results, isSearching, search, clear }
}
