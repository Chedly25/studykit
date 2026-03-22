/**
 * Cross-exam pattern analysis — detects recurring question patterns
 * across multiple past exams to inform study planning.
 */
import { db } from '../db'

export interface ExamPattern {
  topicId: string
  topicName: string
  frequency: number             // 0-1: fraction of exams that include this topic
  avgDifficulty: number
  avgExerciseCount: number
  difficultyRange: [number, number]
  yearsAppeared: number[]
  totalExercises: number
}

export interface ExamPatternAnalysis {
  totalExams: number
  examYears: number[]
  patterns: ExamPattern[]
  predictions: string[]
}

export async function analyzeExamPatterns(examProfileId: string): Promise<ExamPatternAnalysis> {
  const examSources = await db.examSources.where('examProfileId').equals(examProfileId).toArray()
  if (examSources.length < 2) {
    return { totalExams: examSources.length, examYears: [], patterns: [], predictions: [] }
  }

  const exercises = await db.exercises.where('examProfileId').equals(examProfileId).filter(e => !e.hidden).toArray()
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const topicMap = new Map(topics.map(t => [t.id, t.name]))

  const examYears = examSources.map(s => s.year).filter((y): y is number => !!y).sort()

  // Group exercises by exam source
  const exercisesByExam = new Map<string, typeof exercises>()
  for (const ex of exercises) {
    if (!exercisesByExam.has(ex.examSourceId)) exercisesByExam.set(ex.examSourceId, [])
    exercisesByExam.get(ex.examSourceId)!.push(ex)
  }

  // For each topic: count appearances across exams
  const topicStats = new Map<string, {
    examIds: Set<string>
    difficulties: number[]
    exerciseCounts: Map<string, number> // examId → count in that exam
    years: Set<number>
  }>()

  for (const [examSourceId, examExercises] of exercisesByExam) {
    const source = examSources.find(s => s.id === examSourceId)
    for (const ex of examExercises) {
      const topicIds: string[] = JSON.parse(ex.topicIds || '[]')
      for (const tid of topicIds) {
        if (!topicMap.has(tid)) continue
        if (!topicStats.has(tid)) {
          topicStats.set(tid, {
            examIds: new Set(),
            difficulties: [],
            exerciseCounts: new Map(),
            years: new Set(),
          })
        }
        const stats = topicStats.get(tid)!
        stats.examIds.add(examSourceId)
        stats.difficulties.push(ex.difficulty)
        stats.exerciseCounts.set(examSourceId, (stats.exerciseCounts.get(examSourceId) ?? 0) + 1)
        if (source?.year) stats.years.add(source.year)
      }
    }
  }

  const totalExams = examSources.length
  const patterns: ExamPattern[] = []

  for (const [topicId, stats] of topicStats) {
    const avgDiff = stats.difficulties.reduce((a, b) => a + b, 0) / stats.difficulties.length
    const counts = [...stats.exerciseCounts.values()]
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length

    patterns.push({
      topicId,
      topicName: topicMap.get(topicId) ?? 'Unknown',
      frequency: stats.examIds.size / totalExams,
      avgDifficulty: Math.round(avgDiff * 10) / 10,
      avgExerciseCount: Math.round(avgCount * 10) / 10,
      difficultyRange: [
        Math.min(...stats.difficulties),
        Math.max(...stats.difficulties),
      ],
      yearsAppeared: [...stats.years].sort(),
      totalExercises: stats.difficulties.length,
    })
  }

  patterns.sort((a, b) => b.frequency - a.frequency)

  // Generate predictions
  const predictions: string[] = []
  for (const p of patterns.slice(0, 5)) {
    const pct = Math.round(p.frequency * 100)
    if (pct === 100) {
      predictions.push(`${p.topicName} appears in every exam, avg difficulty ${p.avgDifficulty}/5`)
    } else if (pct >= 75) {
      predictions.push(`${p.topicName} appears in ${pct}% of exams, avg ${p.avgExerciseCount} questions`)
    }
  }

  return { totalExams, examYears, patterns, predictions }
}
