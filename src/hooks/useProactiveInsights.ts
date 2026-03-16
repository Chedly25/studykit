import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Assignment, DailyStudyLog, Topic } from '../db/schema'
import type { Insight } from '../components/dashboard/InsightCard'

export function useProactiveInsights(examProfileId: string | undefined) {
  const profile = useLiveQuery(
    () => examProfileId ? db.examProfiles.get(examProfileId) : undefined,
    [examProfileId]
  )

  const assignments = useLiveQuery(
    () => examProfileId
      ? db.assignments.where('examProfileId').equals(examProfileId).toArray()
      : db.assignments.toArray(),
    [examProfileId]
  ) ?? [] as Assignment[]

  const dailyLogs = useLiveQuery(
    () => examProfileId
      ? db.dailyStudyLogs.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as DailyStudyLog[]),
    [examProfileId]
  ) ?? [] as DailyStudyLog[]

  const topics = useLiveQuery(
    () => examProfileId
      ? db.topics.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as Topic[]),
    [examProfileId]
  ) ?? [] as Topic[]

  const insights = useMemo(() => {
    const result: Insight[] = []
    const today = new Date().toISOString().slice(0, 10)
    const threeDaysOut = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)

    // Overdue assignments
    const overdue = assignments.filter(a => a.status !== 'done' && a.dueDate < today)
    if (overdue.length > 0) {
      result.push({
        type: 'warning',
        message: `You have ${overdue.length} overdue assignment${overdue.length > 1 ? 's' : ''}. Consider prioritizing ${overdue[0].title}.`,
      })
    }

    // Upcoming deadlines
    const upcoming = assignments.filter(a => a.status !== 'done' && a.dueDate >= today && a.dueDate <= threeDaysOut)
    if (upcoming.length > 0) {
      result.push({
        type: 'tip',
        message: `${upcoming.length} assignment${upcoming.length > 1 ? 's' : ''} due in the next 3 days.`,
      })
    }

    // Study consistency
    if (dailyLogs.length >= 3) {
      const lastThree = [...dailyLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
      const avgSeconds = lastThree.reduce((s, l) => s + l.totalSeconds, 0) / 3
      if (avgSeconds < 1800 && profile?.weeklyTargetHours && profile.weeklyTargetHours >= 10) {
        result.push({
          type: 'warning',
          message: 'Your study time has dropped below 30 min/day recently. Try a quick 25-minute focus session.',
        })
      }
    }

    // Exam urgency
    if (profile?.examDate) {
      const daysLeft = Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000)
      if (daysLeft <= 30 && daysLeft > 0) {
        result.push({
          type: 'warning',
          message: `Only ${daysLeft} days until your exam. Focus on weak topics to maximize your score.`,
        })
      }
    }

    // Weak topics
    const veryWeak = topics.filter(t => t.mastery < 0.2 && t.questionsAttempted > 0)
    if (veryWeak.length >= 3) {
      result.push({
        type: 'tip',
        message: `${veryWeak.length} topics are below 20% mastery. Consider scheduling focused review sessions.`,
      })
    }

    // Encouragement
    if (dailyLogs.length > 0) {
      const sorted = [...dailyLogs].sort((a, b) => b.date.localeCompare(a.date))
      if (sorted[0].date === today && sorted[0].totalSeconds > 3600) {
        result.push({
          type: 'encouragement',
          message: 'Great work today! You\'ve already studied for over an hour. Keep it up!',
        })
      }
    }

    // Welcome insight for brand-new users
    if (result.length === 0 && dailyLogs.length === 0 && topics.filter(t => t.questionsAttempted > 0).length === 0) {
      result.push({
        type: 'tip',
        message: 'Welcome! Start by uploading your study materials to get personalized recommendations.',
      })
    }

    return result
  }, [assignments, dailyLogs, topics, profile])

  return insights
}
