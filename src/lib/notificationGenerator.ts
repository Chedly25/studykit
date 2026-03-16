/**
 * Notification generator — creates persistent in-app notifications.
 * Idempotent: checks if already created today before creating new ones.
 */
import { db } from '../db'
import type { Notification, NotificationType } from '../db/schema'

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

  // Check due flashcards
  if (!prefs || prefs.reviewDue) {
    const dueCount = await db.flashcards
      .where('nextReviewDate')
      .belowOrEqual(today)
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
    if (profile) {
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
