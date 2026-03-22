/**
 * Client-side weekly email digest trigger.
 * Checks on app load if 7 days have passed since last digest,
 * assembles stats from IndexedDB, and sends via /api/send-notification.
 */
import { useEffect } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useExamProfile } from './useExamProfile'
import { db } from '../db'
import { decayedMastery } from '../lib/knowledgeGraph'

const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const LAST_SENT_KEY = (pid: string) => `weekly_digest_sent_${pid}`

export function useWeeklyDigest() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { activeProfile } = useExamProfile()

  useEffect(() => {
    const profileId = activeProfile?.id
    if (!profileId || !user) return

    const email = user.primaryEmailAddress?.emailAddress
    if (!email) return

    // Check if digest is due
    const lastSent = localStorage.getItem(LAST_SENT_KEY(profileId))
    if (lastSent && Date.now() - new Date(lastSent).getTime() < DIGEST_INTERVAL_MS) return

    // Don't send on first app use (no data yet)
    const hasLogs = localStorage.getItem(`session_start_${profileId}_${new Date().toISOString().slice(0, 10)}`)
    if (!lastSent && !hasLogs) {
      // Set initial timestamp so first digest is sent 7 days from now
      localStorage.setItem(LAST_SENT_KEY(profileId), new Date().toISOString())
      return
    }

    // Check preferences
    ;(async () => {
      try {
        const prefs = await db.notificationPreferences.where('examProfileId').equals(profileId).first()
        if (prefs && prefs.weeklyDigest === false) return

        const stats = await assembleWeeklyStats(profileId)
        const token = await getToken()
        if (!token) return

        const html = buildDigestHtml(activeProfile.name, stats)
        await fetch('/api/send-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            to: email,
            subject: `Your weekly study report — ${activeProfile.name}`,
            html,
          }),
        })

        localStorage.setItem(LAST_SENT_KEY(profileId), new Date().toISOString())
      } catch {
        // Non-critical — silently fail
      }
    })()
  }, [activeProfile?.id, activeProfile?.name, user, getToken])
}

interface WeeklyStats {
  studyHours: number
  prevWeekHours: number
  questionsAnswered: number
  accuracy: number
  streak: number
  dueFlashcards: number
  daysUntilExam: number | null
  weakTopics: Array<{ name: string; mastery: number }>
  masteryChanges: Array<{ name: string; delta: number }>
}

async function assembleWeeklyStats(profileId: string): Promise<WeeklyStats> {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000)
  const today = now.toISOString().slice(0, 10)

  // Study hours this week vs last week
  const allLogs = await db.dailyStudyLogs.where('examProfileId').equals(profileId).toArray()
  const thisWeekLogs = allLogs.filter(l => l.date >= weekAgo.toISOString().slice(0, 10))
  const prevWeekLogs = allLogs.filter(l => l.date >= twoWeeksAgo.toISOString().slice(0, 10) && l.date < weekAgo.toISOString().slice(0, 10))
  const studyHours = Math.round(thisWeekLogs.reduce((s, l) => s + l.totalSeconds, 0) / 3600 * 10) / 10
  const prevWeekHours = Math.round(prevWeekLogs.reduce((s, l) => s + l.totalSeconds, 0) / 3600 * 10) / 10

  // Questions this week
  const questionsThisWeek = thisWeekLogs.reduce((s, l) => s + (l.questionsAnswered ?? 0), 0)
  const correctThisWeek = thisWeekLogs.reduce((s, l) => s + (l.questionsCorrect ?? 0), 0)
  const accuracy = questionsThisWeek > 0 ? Math.round((correctThisWeek / questionsThisWeek) * 100) : 0

  // Streak
  let streak = 0
  const sortedDates = allLogs.map(l => l.date).sort().reverse()
  if (sortedDates[0] === today || sortedDates[0] === new Date(now.getTime() - 86400000).toISOString().slice(0, 10)) {
    streak = 1
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1])
      const curr = new Date(sortedDates[i])
      if (Math.abs((prev.getTime() - curr.getTime()) / 86400000 - 1) < 0.1) streak++
      else break
    }
  }

  // Due flashcards
  const decks = await db.flashcardDecks.where('examProfileId').equals(profileId).toArray()
  const deckIds = new Set(decks.map(d => d.id))
  const dueFlashcards = await db.flashcards.where('nextReviewDate').belowOrEqual(today).filter(c => deckIds.has(c.deckId)).count()

  // Exam countdown
  const profile = await db.examProfiles.get(profileId)
  const daysUntilExam = profile?.examDate
    ? Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - now.getTime()) / 86400000))
    : null

  // Weak topics
  const topics = await db.topics.where('examProfileId').equals(profileId).toArray()
  const weakTopics = topics
    .filter(t => t.mastery > 0 || t.questionsAttempted > 0)
    .map(t => ({ name: t.name, mastery: Math.round(decayedMastery(t) * 100) }))
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3)

  // Mastery changes (compare snapshots from 7 days ago to today)
  const snapshots = await db.masterySnapshots.where('examProfileId').equals(profileId).toArray()
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)
  const masteryChanges: Array<{ name: string; delta: number }> = []
  for (const t of topics) {
    const oldSnap = snapshots.find(s => s.topicId === t.id && s.date <= weekAgoStr)
    const newSnap = snapshots.find(s => s.topicId === t.id && s.date === today)
    if (oldSnap && newSnap) {
      const delta = Math.round((newSnap.mastery - oldSnap.mastery) * 100)
      if (Math.abs(delta) >= 3) {
        masteryChanges.push({ name: t.name, delta })
      }
    }
  }
  masteryChanges.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  return {
    studyHours, prevWeekHours, questionsAnswered: questionsThisWeek,
    accuracy, streak, dueFlashcards, daysUntilExam, weakTopics,
    masteryChanges: masteryChanges.slice(0, 5),
  }
}

function buildDigestHtml(profileName: string, stats: WeeklyStats): string {
  const hoursDiff = stats.studyHours - stats.prevWeekHours
  const hoursTrend = hoursDiff > 0 ? `+${hoursDiff}h vs last week` : hoursDiff < 0 ? `${hoursDiff}h vs last week` : 'same as last week'

  const masteryLines = stats.masteryChanges.map(m =>
    m.delta > 0
      ? `<li style="color:#10b981">&uarr; ${m.name} +${m.delta}%</li>`
      : `<li style="color:#ef4444">&darr; ${m.name} ${m.delta}%</li>`
  ).join('')

  const weakLines = stats.weakTopics.map(t =>
    `<li>${t.name} (${t.mastery}%)</li>`
  ).join('')

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:24px;color:#1a1a2e">
  <div style="text-align:center;margin-bottom:24px">
    <img src="https://studieskit.com/favicon-48x48.png" width="32" height="32" style="border-radius:8px" />
    <h2 style="margin:8px 0 0;font-size:18px">Weekly Study Report</h2>
    <p style="color:#666;font-size:13px;margin:4px 0">${profileName}</p>
  </div>

  <div style="background:#f8f9fa;border-radius:12px;padding:16px;margin-bottom:16px">
    <h3 style="font-size:14px;margin:0 0 12px;color:#333">This Week</h3>
    <ul style="list-style:none;padding:0;margin:0;font-size:13px;line-height:1.8">
      <li><strong>${stats.studyHours}h</strong> studied (${hoursTrend})</li>
      <li><strong>${stats.questionsAnswered}</strong> questions answered (${stats.accuracy}% accuracy)</li>
      <li><strong>${stats.streak}</strong> day streak</li>
      ${stats.dueFlashcards > 0 ? `<li><strong>${stats.dueFlashcards}</strong> flashcards due</li>` : ''}
      ${stats.daysUntilExam !== null ? `<li><strong>${stats.daysUntilExam}</strong> days until exam</li>` : ''}
    </ul>
  </div>

  ${masteryLines ? `
  <div style="background:#f8f9fa;border-radius:12px;padding:16px;margin-bottom:16px">
    <h3 style="font-size:14px;margin:0 0 8px;color:#333">Mastery Changes</h3>
    <ul style="list-style:none;padding:0;margin:0;font-size:13px;line-height:1.6">${masteryLines}</ul>
  </div>` : ''}

  ${weakLines ? `
  <div style="background:#fff3cd;border-radius:12px;padding:16px;margin-bottom:16px">
    <h3 style="font-size:14px;margin:0 0 8px;color:#856404">Focus This Week</h3>
    <ul style="list-style:none;padding:0;margin:0;font-size:13px;line-height:1.6;color:#856404">${weakLines}</ul>
  </div>` : ''}

  <div style="text-align:center;margin-top:24px">
    <a href="https://studieskit.com/queue" style="display:inline-block;background:#10b981;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Open StudiesKit</a>
  </div>

  <p style="text-align:center;font-size:11px;color:#999;margin-top:24px">
    <a href="https://studieskit.com/settings?unsubscribe=weekly" style="color:#999">Unsubscribe from weekly digest</a>
  </p>
</div>`
}
