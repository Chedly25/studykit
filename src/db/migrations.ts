/**
 * One-time migration: copy localStorage data into IndexedDB.
 * Sets 'studieskit-migrated' flag when complete.
 * Safe to run multiple times — skips if already migrated.
 */
import { db } from './index'
import type {
  FlashcardDeck,
  Flashcard,
  Assignment,
  UserPreferences,
} from './schema'
import { loadFromStorage } from '../lib/timerUtils'

const MIGRATION_FLAG = 'studieskit-migrated'

interface LegacyDeck {
  id: string
  name: string
  cards: Array<{
    id: string
    front: string
    back: string
    easeFactor: number
    interval: number
    repetitions: number
    nextReviewDate: string
    lastRating: number
  }>
}

interface LegacyAssignment {
  id: string
  title: string
  description: string
  dueDate: string
  priority: 'low' | 'medium' | 'high'
  status: 'todo' | 'in-progress' | 'done'
  createdAt: string
}

export async function runMigration(): Promise<void> {
  // Skip if already done
  if (localStorage.getItem(MIGRATION_FLAG) === 'true') return

  // Check if IndexedDB is available
  if (!window.indexedDB) return

  try {
    await migrateFlashcards()
    await migrateAssignments()
    await migrateTheme()
    // ExamCountdown, StudyTimeTracker, PomodoroTimer, GPA
    // stay in localStorage for now — they'll be migrated when
    // those tools are refactored to use IndexedDB hooks

    localStorage.setItem(MIGRATION_FLAG, 'true')
  } catch (err) {
    console.warn('[StudiesKit] Migration failed, will retry next load:', err)
  }
}

async function migrateFlashcards(): Promise<void> {
  const legacyDecks = loadFromStorage<LegacyDeck[]>('studieskit-smart-flashcards', [])
  if (legacyDecks.length === 0) return

  // Check if already migrated (idempotent)
  const existing = await db.flashcardDecks.count()
  if (existing > 0) return

  const decks: FlashcardDeck[] = []
  const cards: Flashcard[] = []

  for (const ld of legacyDecks) {
    decks.push({
      id: ld.id,
      name: ld.name,
      createdAt: new Date().toISOString(),
    })

    for (const lc of ld.cards) {
      cards.push({
        id: lc.id,
        deckId: ld.id,
        front: lc.front,
        back: lc.back,
        source: 'manual',
        easeFactor: lc.easeFactor,
        interval: lc.interval,
        repetitions: lc.repetitions,
        nextReviewDate: lc.nextReviewDate,
        lastRating: lc.lastRating,
      })
    }
  }

  await db.flashcardDecks.bulkPut(decks)
  await db.flashcards.bulkPut(cards)
}

async function migrateAssignments(): Promise<void> {
  const legacy = loadFromStorage<LegacyAssignment[]>('studieskit-assignments', [])
  if (legacy.length === 0) return

  const existing = await db.assignments.count()
  if (existing > 0) return

  const assignments: Assignment[] = legacy.map(la => ({
    id: la.id,
    title: la.title,
    description: la.description,
    dueDate: la.dueDate,
    priority: la.priority,
    status: la.status,
    createdAt: la.createdAt,
  }))

  await db.assignments.bulkPut(assignments)
}

async function migrateTheme(): Promise<void> {
  const theme = localStorage.getItem('studieskit-theme')
  if (!theme || (theme !== 'light' && theme !== 'dark')) return

  const existing = await db.userPreferences.get('default')
  if (existing) return

  const prefs: UserPreferences = {
    id: 'default',
    theme,
    pomodoroWorkDuration: 25,
    pomodoroShortBreak: 5,
    pomodoroLongBreak: 15,
    pomodoroLongBreakInterval: 4,
  }

  await db.userPreferences.put(prefs)
}
