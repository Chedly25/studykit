/**
 * Exam Strategist Agent — analyzes HOW a student takes exams.
 * Not what they got wrong (that's the diagnostician) but their exam STRATEGY:
 * time allocation, attempt efficiency, optimal question ordering.
 *
 * Runs after each practice exam. Output surfaces on exam results page.
 */
import { db } from '../../db'
import type { AgentDefinition, AgentContext } from './types'

export interface ExamStrategy {
  sessionId: string
  timeDistribution: Array<{
    partIndex: number
    partName: string
    timeSpent: number      // seconds
    questionCount: number
    pointsEarned: number
    pointsMax: number
  }>
  attemptEfficiency: {
    totalQuestions: number
    attempted: number
    correct: number
    wrong: number
    skipped: number
    pointsEarned: number
    pointsMax: number
    pointsLostOnWrongAttempts: number
    pointsPossibleFromSkipped: number
  }
  timeManagement: {
    totalTimeUsed: number    // seconds
    avgTimePerQuestion: number
    fastestQuestion: { index: number; time: number }
    slowestQuestion: { index: number; time: number }
    timeInFirstHalf: number
    timeInSecondHalf: number
  }
  recommendations: string[]
}

function analyzeExamStrategy(
  questions: Array<{
    questionIndex: number
    sectionIndex?: number
    points: number
    earnedPoints?: number
    isCorrect?: boolean
    isAnswered: boolean
    timeSpentSeconds?: number
    difficulty: number
  }>,
  sessionId: string,
): ExamStrategy {
  const totalQuestions = questions.length
  const attempted = questions.filter(q => q.isAnswered).length
  const correct = questions.filter(q => q.isCorrect).length
  const wrong = questions.filter(q => q.isAnswered && !q.isCorrect).length
  const skipped = totalQuestions - attempted
  const pointsEarned = questions.reduce((s, q) => s + (q.earnedPoints ?? 0), 0)
  const pointsMax = questions.reduce((s, q) => s + q.points, 0)
  const pointsLostOnWrong = questions
    .filter(q => q.isAnswered && !q.isCorrect)
    .reduce((s, q) => s + q.points, 0) // Points they could have gotten if correct
  const pointsPossibleSkipped = questions
    .filter(q => !q.isAnswered)
    .reduce((s, q) => s + q.points, 0)

  // Time analysis
  const withTime = questions.filter(q => q.timeSpentSeconds != null && q.timeSpentSeconds > 0)
  const totalTime = withTime.reduce((s, q) => s + (q.timeSpentSeconds ?? 0), 0)
  const avgTime = withTime.length > 0 ? totalTime / withTime.length : 0

  const sorted = [...withTime].sort((a, b) => (a.timeSpentSeconds ?? 0) - (b.timeSpentSeconds ?? 0))
  const fastest = sorted[0]
  const slowest = sorted[sorted.length - 1]

  const midpoint = Math.floor(questions.length / 2)
  const firstHalf = questions.slice(0, midpoint)
  const secondHalf = questions.slice(midpoint)
  const timeFirstHalf = firstHalf.reduce((s, q) => s + (q.timeSpentSeconds ?? 0), 0)
  const timeSecondHalf = secondHalf.reduce((s, q) => s + (q.timeSpentSeconds ?? 0), 0)

  // Part-level analysis
  const parts = new Map<number, { name: string; time: number; questions: number; earned: number; max: number }>()
  for (const q of questions) {
    const pi = q.sectionIndex ?? 0
    const entry = parts.get(pi) ?? { name: `Part ${pi + 1}`, time: 0, questions: 0, earned: 0, max: 0 }
    entry.time += q.timeSpentSeconds ?? 0
    entry.questions++
    entry.earned += q.earnedPoints ?? 0
    entry.max += q.points
    parts.set(pi, entry)
  }

  // Generate recommendations
  const recommendations: string[] = []

  // Time balance
  if (timeFirstHalf > 0 && timeSecondHalf > 0) {
    const ratio = timeFirstHalf / (timeFirstHalf + timeSecondHalf)
    if (ratio > 0.65) {
      recommendations.push(`You spent ${Math.round(ratio * 100)}% of your time on the first half. The second half often has higher-value questions — consider moving faster through early questions.`)
    }
  }

  // Attempt efficiency
  if (wrong > 0 && skipped > 0) {
    const avgPointsWrong = pointsLostOnWrong / wrong
    const avgPointsSkipped = pointsPossibleSkipped / skipped
    if (avgPointsSkipped > avgPointsWrong) {
      recommendations.push(`You skipped questions worth ${Math.round(avgPointsSkipped)} pts avg but attempted and got wrong questions worth ${Math.round(avgPointsWrong)} pts avg. Consider attempting the higher-value skipped questions first.`)
    }
  }

  if (wrong > attempted * 0.4 && skipped > 0) {
    recommendations.push(`${Math.round((wrong / attempted) * 100)}% of your attempts were wrong. Being more selective about which questions to attempt could improve your score.`)
  }

  // Slowest question
  if (slowest && avgTime > 0 && (slowest.timeSpentSeconds ?? 0) > avgTime * 3) {
    recommendations.push(`Question ${slowest.questionIndex + 1} took ${Math.round((slowest.timeSpentSeconds ?? 0) / 60)} minutes — 3x your average. Setting a time limit per question would help.`)
  }

  if (recommendations.length === 0) {
    recommendations.push('Good time management on this exam. Keep this pacing for future exams.')
  }

  return {
    sessionId,
    timeDistribution: [...parts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([pi, data]) => ({ partIndex: pi, partName: data.name, timeSpent: data.time, questionCount: data.questions, pointsEarned: data.earned, pointsMax: data.max })),
    attemptEfficiency: {
      totalQuestions, attempted, correct, wrong, skipped,
      pointsEarned, pointsMax,
      pointsLostOnWrongAttempts: pointsLostOnWrong,
      pointsPossibleFromSkipped: pointsPossibleSkipped,
    },
    timeManagement: {
      totalTimeUsed: totalTime,
      avgTimePerQuestion: Math.round(avgTime),
      fastestQuestion: fastest ? { index: fastest.questionIndex, time: fastest.timeSpentSeconds ?? 0 } : { index: 0, time: 0 },
      slowestQuestion: slowest ? { index: slowest.questionIndex, time: slowest.timeSpentSeconds ?? 0 } : { index: 0, time: 0 },
      timeInFirstHalf: timeFirstHalf,
      timeInSecondHalf: timeSecondHalf,
    },
    recommendations,
  }
}

export const examStrategistAgent: AgentDefinition = {
  id: 'strategist',
  name: 'Exam Strategist',
  description: 'Analyzes exam-taking strategy: time allocation, attempt efficiency, optimal question ordering',
  model: 'fast',
  triggers: ['event'],
  cooldownMs: 0, // No cooldown — runs per exam
  async execute(ctx: AgentContext) {
    const examProfileId = ctx.examProfileId
    // Find the most recent graded exam
    const sessions = await db.practiceExamSessions
      .where('examProfileId').equals(examProfileId)
      .filter(s => s.phase === 'graded' && s.totalScore != null)
      .toArray()

    if (sessions.length === 0) return { success: false, summary: 'No graded sessions', episodes: [] }

    const latest = sessions.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0]

    // Check if we already analyzed this session
    const existingInsight = await db.agentInsights.get(`exam-strategist:${latest.id}`)
    if (existingInsight) return { success: false, summary: 'Already analyzed', episodes: [] }

    const questions = await db.generatedQuestions
      .where('sessionId').equals(latest.id)
      .sortBy('questionIndex')

    if (questions.length === 0) return { success: false, summary: 'No questions found', episodes: [] }

    const strategy = analyzeExamStrategy(
      questions.map(q => ({
        questionIndex: q.questionIndex,
        sectionIndex: q.sectionIndex,
        points: q.points,
        earnedPoints: q.earnedPoints,
        isCorrect: q.isCorrect,
        isAnswered: q.isAnswered,
        timeSpentSeconds: q.timeSpentSeconds,
        difficulty: q.difficulty,
      })),
      latest.id,
    )

    const now = new Date().toISOString()
    await db.agentInsights.put({
      id: `exam-strategist:${latest.id}`,
      agentId: 'exam-strategist',
      examProfileId,
      data: JSON.stringify(strategy),
      summary: strategy.recommendations[0] ?? 'Exam strategy analyzed',
      createdAt: now,
      updatedAt: now,
    })

    return { success: true, summary: strategy.recommendations[0] ?? 'Exam strategy analyzed', data: strategy, episodes: [] }
  },
}
