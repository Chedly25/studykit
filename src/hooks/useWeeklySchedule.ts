/**
 * Aggregates due SRS items by day for the next 7 days.
 * Used by WeeklyScheduleCard on the dashboard.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export interface DaySchedule {
  date: string        // YYYY-MM-DD
  dayLabel: string    // Mon, Tue, etc.
  total: number
  flashcards: number
  exercises: number
  concepts: number
  isToday: boolean
}

export function useWeeklySchedule(examProfileId?: string): DaySchedule[] {
  return useLiveQuery(async () => {
    if (!examProfileId) return []

    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    // Get profile decks for flashcard filtering
    const decks = await db.flashcardDecks.where('examProfileId').equals(examProfileId).toArray()
    const deckIds = new Set(decks.map(d => d.id))

    // Pre-load all data for the 7-day window to avoid N+1 queries
    const endDate = new Date(today.getTime() + 6 * 86400000).toISOString().slice(0, 10)

    const allFlashcards = await db.flashcards
      .where('nextReviewDate')
      .between(todayStr, endDate, true, true)
      .filter(c => deckIds.has(c.deckId))
      .toArray()

    const allExercises = await db.exercises
      .where('examProfileId').equals(examProfileId)
      .filter(e => !e.hidden && e.nextReviewDate >= todayStr && e.nextReviewDate <= endDate)
      .toArray()

    const allConcepts = await db.conceptCards
      .where('examProfileId').equals(examProfileId)
      .filter(c => c.nextReviewDate !== undefined && c.nextReviewDate >= todayStr && c.nextReviewDate <= endDate)
      .toArray()

    const days: DaySchedule[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() + i * 86400000)
      const dateStr = d.toISOString().slice(0, 10)
      const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' })

      const flashcards = allFlashcards.filter(c => c.nextReviewDate === dateStr).length
      const exercises = allExercises.filter(e => e.nextReviewDate === dateStr).length
      const concepts = allConcepts.filter(c => c.nextReviewDate === dateStr).length

      days.push({
        date: dateStr,
        dayLabel,
        total: flashcards + exercises + concepts,
        flashcards,
        exercises,
        concepts,
        isToday: i === 0,
      })
    }
    return days
  }, [examProfileId]) ?? []
}
