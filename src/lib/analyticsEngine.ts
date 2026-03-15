/**
 * Pure functions for study analytics computations.
 */
import type { StudySession, DailyStudyLog, QuestionResult } from '../db/schema'

export interface WeeklyHoursData {
  date: string
  hours: number
  subjectBreakdown: Record<string, number>
}

export function computeWeeklyHoursChart(logs: DailyStudyLog[], days = 7): WeeklyHoursData[] {
  const result: WeeklyHoursData[] = []
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const log = logs.find(l => l.date === dateStr)

    const breakdown: Record<string, number> = {}
    if (log) {
      for (const sb of log.subjectBreakdown) {
        breakdown[sb.subjectId] = sb.seconds / 3600
      }
    }

    result.push({
      date: dateStr,
      hours: log ? log.totalSeconds / 3600 : 0,
      subjectBreakdown: breakdown,
    })
  }

  return result
}

export interface MasteryTrendPoint {
  date: string
  mastery: number
}

export function computeMasteryTrend(
  questionResults: QuestionResult[],
  topicId: string,
  days = 30
): MasteryTrendPoint[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString()

  const relevant = questionResults
    .filter(q => q.topicId === topicId && q.timestamp >= cutoffStr)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  if (relevant.length === 0) return []

  const points: MasteryTrendPoint[] = []
  let correct = 0
  let total = 0

  for (const q of relevant) {
    total++
    if (q.isCorrect) correct++
    points.push({
      date: q.timestamp.slice(0, 10),
      mastery: correct / total,
    })
  }

  return points
}

export interface SessionDistribution {
  type: string
  count: number
  totalMinutes: number
}

export function computeSessionDistribution(sessions: StudySession[]): SessionDistribution[] {
  const map = new Map<string, { count: number; totalSeconds: number }>()

  for (const s of sessions) {
    const existing = map.get(s.type) ?? { count: 0, totalSeconds: 0 }
    existing.count++
    existing.totalSeconds += s.durationSeconds
    map.set(s.type, existing)
  }

  return Array.from(map.entries()).map(([type, data]) => ({
    type,
    count: data.count,
    totalMinutes: Math.round(data.totalSeconds / 60),
  }))
}

export interface SubjectBalance {
  name: string
  weight: number // target weight (% of exam)
  actual: number // actual study time proportion
  mastery: number
  color: string
}

export function computeSubjectBalance(
  subjects: Array<{ id: string; name: string; weight: number; mastery: number; color: string }>,
  logs: DailyStudyLog[]
): SubjectBalance[] {
  const totalTime = logs.reduce((sum, l) => sum + l.totalSeconds, 0)
  if (totalTime === 0) {
    return subjects.map(s => ({ name: s.name, weight: s.weight, actual: 0, mastery: s.mastery, color: s.color }))
  }

  const timeBySubject = new Map<string, number>()
  for (const log of logs) {
    for (const sb of log.subjectBreakdown) {
      timeBySubject.set(sb.subjectId, (timeBySubject.get(sb.subjectId) ?? 0) + sb.seconds)
    }
  }

  return subjects.map(s => ({
    name: s.name,
    weight: s.weight,
    actual: ((timeBySubject.get(s.id) ?? 0) / totalTime) * 100,
    mastery: s.mastery,
    color: s.color,
  }))
}

export function computeScoreTrend(
  questionResults: QuestionResult[],
  windowSize = 10
): Array<{ index: number; score: number }> {
  if (questionResults.length === 0) return []

  const sorted = [...questionResults].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const result: Array<{ index: number; score: number }> = []

  for (let i = windowSize - 1; i < sorted.length; i++) {
    const window = sorted.slice(i - windowSize + 1, i + 1)
    const correct = window.filter(q => q.isCorrect).length
    result.push({ index: i, score: (correct / windowSize) * 100 })
  }

  return result
}
