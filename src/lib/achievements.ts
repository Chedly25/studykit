/**
 * Achievement definitions and checker.
 * ~20 achievements across categories: streak, volume, mastery, special.
 */
import { db } from '../db'
import type { AchievementRecord } from '../db/schema'

export interface AchievementDef {
  id: string
  title: string
  description: string
  category: 'streak' | 'volume' | 'mastery' | 'special'
  icon: string // emoji
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Streak
  { id: 'FIRST_SESSION', title: 'First Steps', description: 'Complete your first study session', category: 'streak', icon: '🎯' },
  { id: 'STREAK_7', title: 'Week Warrior', description: '7-day study streak', category: 'streak', icon: '🔥' },
  { id: 'STREAK_30', title: 'Monthly Master', description: '30-day study streak', category: 'streak', icon: '💪' },
  { id: 'STREAK_100', title: 'Century Club', description: '100-day study streak', category: 'streak', icon: '👑' },
  // Volume
  { id: 'QUESTIONS_25', title: '25 Questions', description: 'Answer 25 questions', category: 'volume', icon: '📝' },
  { id: 'QUESTIONS_100', title: 'Century Mark', description: 'Answer 100 questions', category: 'volume', icon: '📚' },
  { id: 'QUESTIONS_500', title: 'Question Machine', description: 'Answer 500 questions', category: 'volume', icon: '🏆' },
  { id: 'FLASHCARDS_100', title: 'Card Collector', description: 'Review 100 flashcards', category: 'volume', icon: '🃏' },
  { id: 'EXERCISES_50', title: 'Practice Pro', description: 'Complete 50 exercises', category: 'volume', icon: '✏️' },
  // Mastery
  { id: 'FIRST_TOPIC_50', title: 'Getting There', description: 'Reach 50% mastery on any topic', category: 'mastery', icon: '📈' },
  { id: 'FIRST_TOPIC_80', title: 'Near Perfection', description: 'Reach 80% mastery on any topic', category: 'mastery', icon: '⭐' },
  { id: 'ALL_TOPICS_30', title: 'Broad Foundation', description: 'All topics above 30% mastery', category: 'mastery', icon: '🌐' },
  // Special
  { id: 'EARLY_BIRD', title: 'Early Bird', description: 'Study before 8 AM', category: 'special', icon: '🌅' },
  { id: 'NIGHT_OWL', title: 'Night Owl', description: 'Study after 10 PM', category: 'special', icon: '🦉' },
  { id: 'COMEBACK', title: 'Welcome Back', description: 'Return after 7+ days away', category: 'special', icon: '🔄' },
  { id: 'FIVE_TOPICS', title: 'Explorer', description: 'Study 5 different topics', category: 'special', icon: '🗺️' },
  { id: 'TEN_SESSIONS', title: 'Committed', description: 'Complete 10 study sessions', category: 'special', icon: '🎓' },
  { id: 'HOUR_SESSION', title: 'Deep Focus', description: 'Study for 60+ minutes in one session', category: 'special', icon: '🧘' },
  { id: 'THREE_DAY_ROW', title: 'Hat Trick', description: 'Study 3 days in a row', category: 'special', icon: '🎩' },
]

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map(a => [a.id, a]))

export interface AchievementStats {
  streak: number
  totalSessions: number
  totalQuestions: number
  totalFlashcardReviews: number
  totalExerciseAttempts: number
  topicMasteries: Array<{ mastery: number }>
  lastSessionDate: string | null
  currentHour: number
  longestSessionSeconds: number
  distinctTopicsStudied: number
}

export async function getAchievementStats(examProfileId: string): Promise<AchievementStats> {
  const sessions = await db.studySessions.where('examProfileId').equals(examProfileId).toArray()
  const questions = await db.questionResults.where('examProfileId').equals(examProfileId).count()
  const exerciseAttempts = await db.exerciseAttempts.where('examProfileId').equals(examProfileId).count()
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()

  // Count flashcard reviews (cards with repetitions > 0)
  const decks = await db.flashcardDecks.where('examProfileId').equals(examProfileId).toArray()
  const deckIds = new Set(decks.map(d => d.id))
  const allCards = await db.flashcards.toArray()
  const profileCards = allCards.filter(c => deckIds.has(c.deckId))
  const totalFlashcardReviews = profileCards.reduce((sum, c) => sum + c.repetitions, 0)

  // Compute streak from daily logs
  const logs = await db.dailyStudyLogs.where('examProfileId').equals(examProfileId).toArray()
  const logDates = new Set(logs.map(l => l.date))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    if (logDates.has(dateStr)) {
      streak++
    } else if (i > 0) {
      break
    }
  }

  // Last session date + gap detection
  const sortedSessions = sessions.sort((a, b) => b.startTime.localeCompare(a.startTime))
  const lastSessionDate = sortedSessions.length > 0 ? sortedSessions[0].startTime.slice(0, 10) : null

  // Longest session
  const longestSessionSeconds = sessions.reduce((max, s) => Math.max(max, s.durationSeconds), 0)

  // Distinct topics studied
  const distinctTopics = new Set(sessions.filter(s => s.topicId).map(s => s.topicId!))

  return {
    streak,
    totalSessions: sessions.length,
    totalQuestions: questions,
    totalFlashcardReviews,
    totalExerciseAttempts: exerciseAttempts,
    topicMasteries: topics.map(t => ({ mastery: t.mastery })),
    lastSessionDate,
    currentHour: new Date().getHours(),
    longestSessionSeconds,
    distinctTopicsStudied: distinctTopics.size,
  }
}

export async function checkAchievements(examProfileId: string): Promise<AchievementDef[]> {
  const stats = await getAchievementStats(examProfileId)

  // Get already-unlocked achievement IDs
  const existing = await db.achievements.where('examProfileId').equals(examProfileId).toArray()
  const unlockedIds = new Set(existing.map(a => a.achievementId))

  const newlyUnlocked: AchievementDef[] = []

  const check = (id: string, condition: boolean) => {
    if (condition && !unlockedIds.has(id)) {
      const def = ACHIEVEMENT_MAP.get(id)
      if (def) newlyUnlocked.push(def)
    }
  }

  // Streak
  check('FIRST_SESSION', stats.totalSessions >= 1)
  check('THREE_DAY_ROW', stats.streak >= 3)
  check('STREAK_7', stats.streak >= 7)
  check('STREAK_30', stats.streak >= 30)
  check('STREAK_100', stats.streak >= 100)

  // Volume
  check('QUESTIONS_25', stats.totalQuestions >= 25)
  check('QUESTIONS_100', stats.totalQuestions >= 100)
  check('QUESTIONS_500', stats.totalQuestions >= 500)
  check('FLASHCARDS_100', stats.totalFlashcardReviews >= 100)
  check('EXERCISES_50', stats.totalExerciseAttempts >= 50)

  // Mastery
  check('FIRST_TOPIC_50', stats.topicMasteries.some(t => t.mastery >= 0.5))
  check('FIRST_TOPIC_80', stats.topicMasteries.some(t => t.mastery >= 0.8))
  check('ALL_TOPICS_30', stats.topicMasteries.length > 0 && stats.topicMasteries.every(t => t.mastery >= 0.3))

  // Special
  check('EARLY_BIRD', stats.currentHour < 8 && stats.totalSessions >= 1)
  check('NIGHT_OWL', stats.currentHour >= 22 && stats.totalSessions >= 1)
  check('TEN_SESSIONS', stats.totalSessions >= 10)
  check('FIVE_TOPICS', stats.distinctTopicsStudied >= 5)
  check('HOUR_SESSION', stats.longestSessionSeconds >= 3600)

  // Comeback: check if there was a gap > 7 days before the latest session
  if (stats.lastSessionDate) {
    const logs = await db.dailyStudyLogs.where('examProfileId').equals(examProfileId).sortBy('date')
    if (logs.length >= 2) {
      for (let i = 1; i < logs.length; i++) {
        const prev = new Date(logs[i - 1].date).getTime()
        const curr = new Date(logs[i].date).getTime()
        if (curr - prev > 7 * 86400000) {
          check('COMEBACK', true)
          break
        }
      }
    }
  }

  // Save newly unlocked
  if (newlyUnlocked.length > 0) {
    const records: AchievementRecord[] = newlyUnlocked.map(a => ({
      id: crypto.randomUUID(),
      examProfileId,
      achievementId: a.id,
      unlockedAt: new Date().toISOString(),
    }))
    await db.achievements.bulkPut(records)
  }

  return newlyUnlocked
}
