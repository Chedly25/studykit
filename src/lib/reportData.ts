/**
 * Pure functions to compute report data from IndexedDB queries.
 * Used by the exportable study report page.
 */
import { db } from '../db'
import type { Subject, DailyStudyLog } from '../db/schema'
import { computeStreak } from './knowledgeGraph'
import { computeReadinessScore } from './readinessScore'

export interface ReportData {
  profile: { name: string; examDate?: string; examType: string }
  summary: {
    readiness: number
    studyHours: number
    streak: number
    questionsAnswered: number
    accuracy: number
  }
  subjects: Array<{
    id: string
    name: string
    mastery: number
    color: string
    weight: number
  }>
  masteryTrajectory: Map<string, Array<{ date: string; mastery: number }>>
  examHistory: Array<{
    date: string
    score: number
    maxScore: number
    percentage: number
    questionCount: number
    passed: boolean
  }>
  studyHeatmap: Array<{ date: string; hours: number }>
  topics: Array<{
    name: string
    subjectName: string
    mastery: number
    attempted: number
    correct: number
    accuracy: number
    nextReview: string
  }>
  weakAreas: Array<{ name: string; mastery: number; reason: string }>
}

export async function computeReportData(
  examProfileId: string,
): Promise<ReportData | null> {
  const profile = await db.examProfiles.get(examProfileId)
  if (!profile) return null

  // ── Subjects & Topics ────────────────────────────────────────
  const subjects = await db.subjects
    .where('examProfileId')
    .equals(examProfileId)
    .sortBy('order')

  const topics = await db.topics
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  const subjectMap = new Map<string, Subject>()
  for (const s of subjects) subjectMap.set(s.id, s)

  // ── Mastery trajectory (last 30 days) ────────────────────────
  const cutoff30 = new Date()
  cutoff30.setDate(cutoff30.getDate() - 30)
  const cutoffStr = cutoff30.toISOString().slice(0, 10)

  const snapshots = await db.masterySnapshots
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  // Group by subjectId via topic -> subject mapping
  const topicSubjectMap = new Map<string, string>()
  for (const t of topics) topicSubjectMap.set(t.id, t.subjectId)

  // Aggregate snapshots per subject (average mastery per date)
  const subjectTrajectory = new Map<
    string,
    Map<string, { sum: number; count: number }>
  >()

  for (const snap of snapshots) {
    if (snap.date < cutoffStr) continue
    const subjectId = topicSubjectMap.get(snap.topicId)
    if (!subjectId) continue

    if (!subjectTrajectory.has(subjectId)) {
      subjectTrajectory.set(subjectId, new Map())
    }
    const dateMap = subjectTrajectory.get(subjectId)!
    const existing = dateMap.get(snap.date) ?? { sum: 0, count: 0 }
    existing.sum += snap.mastery
    existing.count++
    dateMap.set(snap.date, existing)
  }

  const masteryTrajectory = new Map<
    string,
    Array<{ date: string; mastery: number }>
  >()
  for (const [subjectId, dateMap] of subjectTrajectory) {
    const points = Array.from(dateMap.entries())
      .map(([date, { sum, count }]) => ({
        date,
        mastery: sum / count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
    masteryTrajectory.set(subjectId, points)
  }

  // ── Practice exam history ────────────────────────────────────
  const examSessions = await db.practiceExamSessions
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  const gradedExams = examSessions
    .filter((s) => s.phase === 'graded' && s.totalScore != null && s.maxScore != null)
    .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt))
    .slice(0, 10)

  const passingThreshold = profile.passingThreshold ?? 50

  const examHistory = gradedExams.map((s) => {
    const score = s.totalScore ?? 0
    const maxScore = s.maxScore ?? 1
    const percentage = Math.round((score / maxScore) * 100)
    return {
      date: (s.completedAt ?? s.createdAt).slice(0, 10),
      score,
      maxScore,
      percentage,
      questionCount: s.questionCount,
      passed: percentage >= passingThreshold,
    }
  })

  // ── Daily study logs (last 30 days for heatmap) ──────────────
  const dailyLogs = await db.dailyStudyLogs
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  const logMap = new Map<string, DailyStudyLog>()
  for (const l of dailyLogs) logMap.set(l.date, l)

  const studyHeatmap: Array<{ date: string; hours: number }> = []
  const today = new Date()
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const log = logMap.get(dateStr)
    studyHeatmap.push({
      date: dateStr,
      hours: log ? log.totalSeconds / 3600 : 0,
    })
  }

  // ── Question results for accuracy ────────────────────────────
  const questionResults = await db.questionResults
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  const totalQuestions = questionResults.length
  const correctQuestions = questionResults.filter((q) => q.isCorrect).length
  const accuracy =
    totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0

  // ── Study sessions for total hours ───────────────────────────
  const sessions = await db.studySessions
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  const totalStudySeconds = sessions.reduce(
    (sum, s) => sum + s.durationSeconds,
    0,
  )
  const studyHours = Math.round((totalStudySeconds / 3600) * 10) / 10

  // ── Streak ───────────────────────────────────────────────────
  const { streak } = computeStreak(dailyLogs)

  // ── Readiness ────────────────────────────────────────────────
  const flashcards = await db.flashcards.toArray()
  const profileFlashcards = flashcards.filter((f) => {
    // Flashcards don't have examProfileId directly; filter by topic membership
    if (!f.topicId) return false
    return topics.some((t) => t.id === f.topicId)
  })

  const readiness = computeReadinessScore({
    subjects,
    topics,
    flashcards: profileFlashcards,
    questionResults,
    dailyLogs,
    passingThreshold: profile.passingThreshold,
    weeklyTargetHours: profile.weeklyTargetHours,
  })

  // ── Topic details ────────────────────────────────────────────
  const topicDetails = topics
    .map((t) => {
      const subject = subjectMap.get(t.subjectId)
      const topicAccuracy =
        t.questionsAttempted > 0
          ? Math.round((t.questionsCorrect / t.questionsAttempted) * 100)
          : 0
      return {
        name: t.name,
        subjectName: subject?.name ?? 'Unknown',
        mastery: Math.round(t.mastery * 100),
        attempted: t.questionsAttempted,
        correct: t.questionsCorrect,
        accuracy: topicAccuracy,
        nextReview: t.nextReviewDate,
      }
    })
    .sort((a, b) => a.mastery - b.mastery)

  // ── Weak areas (top 5 weakest topics with reasons) ───────────
  const weakAreas = topicDetails.slice(0, 5).map((t) => {
    let reason: string
    if (t.attempted === 0) {
      reason = 'Not yet practiced'
    } else if (t.accuracy < 40) {
      reason = `Low accuracy (${t.accuracy}%)`
    } else if (t.mastery < 30) {
      reason = 'Low mastery despite attempts'
    } else {
      reason = 'Below average mastery'
    }
    return { name: t.name, mastery: t.mastery, reason }
  })

  // ── Subject mastery ──────────────────────────────────────────
  const subjectData = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    mastery: s.mastery,
    color: s.color,
    weight: s.weight,
  }))

  return {
    profile: {
      name: profile.name,
      examDate: profile.examDate || undefined,
      examType: profile.examType,
    },
    summary: {
      readiness: readiness.overall,
      studyHours,
      streak,
      questionsAnswered: totalQuestions,
      accuracy,
    },
    subjects: subjectData,
    masteryTrajectory,
    examHistory,
    studyHeatmap,
    topics: topicDetails,
    weakAreas,
  }
}
