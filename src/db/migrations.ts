/**
 * One-time migration: copy localStorage data into IndexedDB.
 * Sets 'studieskit-migrated' flag when complete.
 * Safe to run multiple times — skips if already migrated.
 */
import * as Sentry from '@sentry/react'
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
    Sentry.captureException(err instanceof Error ? err : new Error('[StudiesKit] Migration failed, will retry next load: ' + String(err)))
  }
}

async function migrateFlashcards(): Promise<void> {
  const legacyDecks = loadFromStorage<LegacyDeck[]>('studieskit-smart-flashcards', [])
  if (legacyDecks.length === 0) return

  // Check each legacy deck individually — skip those already in DB
  const existingIds = new Set(
    (await db.flashcardDecks.where('id').anyOf(legacyDecks.map(d => d.id)).primaryKeys())
  )

  const decks: FlashcardDeck[] = []
  const cards: Flashcard[] = []

  for (const ld of legacyDecks) {
    if (existingIds.has(ld.id)) continue

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

  if (decks.length > 0) {
    await db.flashcardDecks.bulkPut(decks)
    await db.flashcards.bulkPut(cards)
  }

  localStorage.removeItem('studieskit-smart-flashcards')
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
