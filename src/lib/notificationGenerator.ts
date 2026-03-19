/**
 * Notification generator — creates persistent in-app notifications.
 * Idempotent: checks if already created today before creating new ones.
 */
import { db } from '../db'
import type { Notification, NotificationType } from '../db/schema'
import { decayedMastery } from './knowledgeGraph'

export async function generateNotifications(examProfileId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)

  // Check if we already generated today
  const existingToday = await db.notifications
    .where('examProfileId')
    .equals(examProfileId)
    .filter(n => n.createdAt.startsWith(today))
    .count()

  if (existingToday > 0) return

  // Load preferences
  const prefs = await db.notificationPreferences.get(examProfileId)
  const notifications: Notification[] = []

  // Check due flashcards (scoped to this profile's decks)
  if (!prefs || prefs.reviewDue) {
    const profileDecks = await db.flashcardDecks
      .where('examProfileId').equals(examProfileId).toArray()
    const profileDeckIds = new Set(profileDecks.map(d => d.id))
    const dueCount = await db.flashcards
      .where('nextReviewDate')
      .belowOrEqual(today)
      .filter(c => profileDeckIds.has(c.deckId))
      .count()
    if (dueCount > 0) {
      notifications.push(createNotification(examProfileId, 'review-due',
        `${dueCount} flashcard${dueCount === 1 ? '' : 's'} due`,
        `You have ${dueCount} flashcard${dueCount === 1 ? '' : 's'} ready for review. Consistent review improves long-term retention.`,
        '/flashcard-maker'
      ))
    }
  }

  // Check study streak
  if (!prefs || prefs.streakWarnings) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const yesterdayLog = await db.dailyStudyLogs.get(`${examProfileId}:${yesterday}`)
    const todayLog = await db.dailyStudyLogs.get(`${examProfileId}:${today}`)
    if (!yesterdayLog && !todayLog) {
      notifications.push(createNotification(examProfileId, 'streak-warning',
        'Keep your streak alive!',
        "You haven't studied today or yesterday. Even a short session helps maintain your streak.",
        '/focus'
      ))
    }
  }

  // Check study plan adherence
  if (!prefs || prefs.planSuggestions) {
    const activePlan = await db.studyPlans
      .where('examProfileId').equals(examProfileId)
      .filter(p => p.isActive)
      .first()

    if (!activePlan) {
      notifications.push(createNotification(examProfileId, 'plan-suggestion',
        'No active study plan',
        'Generate an AI-powered study plan to stay organized and focused.',
        '/study-plan'
      ))
    }
  }

  // Check milestones
  if (!prefs || prefs.milestones) {
    const profile = await db.examProfiles.get(examProfileId)
    if (profile && profile.examDate) {
      const daysLeft = Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000)
      if ([30, 14, 7, 3, 1].includes(daysLeft)) {
        notifications.push(createNotification(examProfileId, 'milestone',
          `${daysLeft} day${daysLeft === 1 ? '' : 's'} until ${profile.name}`,
          daysLeft <= 3
            ? 'Final stretch! Focus on review and practice exams.'
            : `Your exam is approaching. Make sure you're on track.`,
          '/dashboard'
        ))
      }
    }
  }

  // Check mastery decay — topics that had decent mastery but have decayed (guarded by reviewDue)
  if (!prefs || prefs.reviewDue) {
    const allTopics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
    const decayedTopic = allTopics.find(t => t.mastery >= 0.4 && decayedMastery(t) < 0.3)
    if (decayedTopic) {
      const dm = Math.round(decayedMastery(decayedTopic) * 100)
      notifications.push(createNotification(examProfileId, 'mastery-drop',
        `${decayedTopic.name} needs attention`,
        `Your mastery of ${decayedTopic.name} has decayed to ${dm}%. A quick review can help.`,
        '/flashcard-maker'
      ))
    }

    // Check weak topics due for review
    const weakDueTopics = allTopics.filter(t => t.mastery < 0.4 && t.nextReviewDate <= today)
    if (weakDueTopics.length > 0) {
      const names = weakDueTopics.slice(0, 3).map(t => t.name).join(', ')
      notifications.push(createNotification(examProfileId, 'weak-topic',
        `${weakDueTopics.length} weak topic${weakDueTopics.length === 1 ? '' : 's'} need review`,
        `${names}${weakDueTopics.length > 3 ? ` and ${weakDueTopics.length - 3} more` : ''} — these topics are below 40% mastery and due for review.`,
        '/exercises'
      ))
    }
  }

  // Check performance alert from latest practice exam (guarded by milestones)
  if (!prefs || prefs.milestones) {
    const examProfile = await db.examProfiles.get(examProfileId)
    if (examProfile) {
      const latestExam = await db.practiceExamSessions
        .where('examProfileId').equals(examProfileId)
        .filter(s => s.phase === 'graded' && s.totalScore !== undefined && s.maxScore !== undefined)
        .last()
      if (latestExam && latestExam.totalScore !== undefined && latestExam.maxScore !== undefined && latestExam.maxScore > 0) {
        const scorePercent = Math.round((latestExam.totalScore / latestExam.maxScore) * 100)
        if (scorePercent < examProfile.passingThreshold) {
          notifications.push(createNotification(examProfileId, 'performance-alert',
            `Practice exam scored ${scorePercent}%`,
            `Your last practice exam scored ${scorePercent}%, below your ${examProfile.passingThreshold}% target. Focus on weak areas.`,
            '/practice-exam'
          ))
        }
      }
    }
  }

  if (notifications.length > 0) {
    await db.notifications.bulkPut(notifications)
  }
}

function createNotification(
  examProfileId: string,
  type: NotificationType,
  title: string,
  message: string,
  actionUrl?: string,
): Notification {
  return {
    id: crypto.randomUUID(),
    examProfileId,
    type,
    title,
    message,
    isRead: false,
    createdAt: new Date().toISOString(),
    actionUrl,
  }
}
