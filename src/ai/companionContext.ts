/**
 * Companion Context — aggregates the student's complete CRFPA exercise history
 * into a unified summary that the companion AI can use to feel "like it knows you."
 *
 * Queries all coaching session stores and returns:
 * - Overall stats (exercises done, average scores)
 * - Per-type breakdowns with trends
 * - Recurring weak axes across all exercise types
 * - Current in-progress exercise (if any)
 * - Last activity summary
 */

import { db } from '../db'
import type { CoachingType } from '../db/schema'

export interface ExerciseTypeSummary {
  type: CoachingType
  count: number
  gradedCount: number
  avgScore: number | null
  maxScore: number
  lastDoneAt: string | null
  lastScore: number | null
  weakAxes: Array<{ axis: string; count: number; avgScore: number }>
}

export interface CompanionContext {
  totalExercises: number
  totalGraded: number
  overallAvgScore: number | null
  daysSinceLastActivity: number | null
  inProgress: {
    type: CoachingType
    id: string
    title: string
    startedAt: string
  } | null
  byType: ExerciseTypeSummary[]
  topWeakAxes: Array<{ axis: string; type: CoachingType; count: number }>
  streakDays: number
  daysUntilExam: number | null
  // Expanded context
  documents: Array<{ title: string; category?: string; createdAt: string }>
  studyMinutesThisWeek: number
  questionsAnsweredThisWeek: number
  dueFlashcardCount: number
  weakTopics: Array<{ name: string; mastery: number; questionsAttempted: number }>
  recentOracleQuestions: string[]
}

const COACHING_TYPES: CoachingType[] = [
  'syllogisme',
  'fiche-arret',
  'plan-detaille',
  'commentaire-arret',
  'cas-pratique',
  'note-synthese',
  'grand-oral',
]

const TYPE_LABELS: Record<CoachingType, string> = {
  syllogisme: 'Syllogisme',
  'fiche-arret': "Fiche d'arrêt",
  'plan-detaille': 'Plan détaillé',
  'commentaire-arret': "Commentaire d'arrêt",
  'cas-pratique': 'Cas pratique',
  'note-synthese': 'Note de synthèse',
  'grand-oral': 'Grand Oral',
}

const TYPE_MAX_SCORES: Record<CoachingType, number> = {
  syllogisme: 30,
  'fiche-arret': 25,
  'plan-detaille': 30,
  'commentaire-arret': 25,
  'cas-pratique': 20,
  'note-synthese': 20,
  'grand-oral': 20,
}

function extractOverallScore(gradingJson: string | undefined): number | null {
  if (!gradingJson) return null
  try {
    const g = JSON.parse(gradingJson) as { overall?: { score?: number } }
    return g.overall?.score ?? null
  } catch {
    return null
  }
}

function extractAxes(gradingJson: string | undefined): Array<{ axis: string; score: number; max: number }> {
  if (!gradingJson) return []
  try {
    const g = JSON.parse(gradingJson) as { axes?: Array<{ axis: string; score: number; max?: number }> }
    return (g.axes ?? []).map(a => ({ axis: a.axis, score: a.score, max: a.max ?? 5 }))
  } catch {
    return []
  }
}

function extractTopMistake(gradingJson: string | undefined): string | null {
  if (!gradingJson) return null
  try {
    const g = JSON.parse(gradingJson) as { overall?: { topMistake?: string } }
    return g.overall?.topMistake ?? null
  } catch {
    return null
  }
}

/**
 * Aggregate all coaching sessions for a profile into companion-ready context.
 */
export async function buildCompanionContext(examProfileId: string): Promise<CompanionContext> {
  const rows = await db.coachingSessions
    .where('examProfileId')
    .equals(examProfileId)
    .toArray()

  // Sort newest first
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // In-progress = has submission but no grading, most recent
  const inProgressRow = rows.find(r => r.submission && !r.grading)
  let inProgress: CompanionContext['inProgress'] = null
  if (inProgressRow) {
    let title = ''
    try {
      const task = JSON.parse(inProgressRow.task)
      title = task.theme ?? task.question ?? task.decision?.chamber ?? task.dossierTitle ?? task.specialtyLabel ?? 'Exercice'
    } catch {
      title = 'Exercice en cours'
    }
    inProgress = {
      type: inProgressRow.type,
      id: inProgressRow.id,
      title,
      startedAt: inProgressRow.createdAt,
    }
  }

  // Per-type summaries
  const byType: ExerciseTypeSummary[] = []
  for (const type of COACHING_TYPES) {
    const typeRows = rows.filter(r => r.type === type)
    const graded = typeRows.filter(r => r.grading)
    const scores = graded
      .map(r => extractOverallScore(r.grading))
      .filter((s): s is number => s !== null)

    // Weak axes: collect all axis scores across graded sessions
    const axisMap = new Map<string, { total: number; count: number; max: number }>()
    for (const r of graded) {
      const axes = extractAxes(r.grading)
      for (const a of axes) {
        const key = a.axis
        const existing = axisMap.get(key) ?? { total: 0, count: 0, max: a.max }
        existing.total += a.score
        existing.count += 1
        axisMap.set(key, existing)
      }
    }
    const weakAxes = Array.from(axisMap.entries())
      .map(([axis, data]) => ({
        axis,
        count: data.count,
        avgScore: data.count > 0 ? data.total / data.count : 0,
        max: data.max,
      }))
      .filter(a => a.avgScore / a.max < 0.5) // Only flag genuinely weak (< 50% of max)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 3)

    byType.push({
      type,
      count: typeRows.length,
      gradedCount: graded.length,
      avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      maxScore: TYPE_MAX_SCORES[type],
      lastDoneAt: typeRows[0]?.createdAt ?? null,
      lastScore: graded[0] ? extractOverallScore(graded[0].grading) : null,
      weakAxes,
    })
  }

  // Overall stats
  const allGraded = rows.filter(r => r.grading)
  const allScores = allGraded
    .map(r => extractOverallScore(r.grading))
    .filter((s): s is number => s !== null)

  const lastActivity = rows[0]?.createdAt
  const daysSinceLastActivity = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000)
    : null

  // Top weak axes globally
  const globalAxisMap = new Map<string, { type: CoachingType; count: number }>()
  for (const r of allGraded) {
    const mistake = extractTopMistake(r.grading)
    if (mistake) {
      const key = `${r.type}:${mistake}`
      const existing = globalAxisMap.get(key) ?? { type: r.type, count: 0 }
      existing.count += 1
      globalAxisMap.set(key, existing)
    }
  }
  const topWeakAxes = Array.from(globalAxisMap.entries())
    .map(([key, data]) => ({ axis: key.split(':')[1], type: data.type, count: data.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Simple streak: consecutive days with at least one exercise
  let streakDays = 0
  if (rows.length > 0) {
    const dates = [...new Set(rows.map(r => r.createdAt.slice(0, 10)))].sort().reverse()
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    let checkDate = dates[0] === today ? today : yesterday
    for (const d of dates) {
      if (d === checkDate) {
        streakDays++
        checkDate = new Date(new Date(checkDate).getTime() - 86400000).toISOString().slice(0, 10)
      } else if (d < checkDate) {
        break
      }
    }
  }

  // Days until exam from profile
  let daysUntilExam: number | null = null
  try {
    const profile = await db.examProfiles.get(examProfileId)
    if (profile?.examDate) {
      daysUntilExam = Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000))
    }
  } catch { /* ignore */ }

  // ─── Uploaded documents ─────────────────────────────────────────
  const documents = await db.documents
    .where('examProfileId')
    .equals(examProfileId)
    .reverse()
    .sortBy('createdAt')
  const recentDocs = documents.slice(0, 5).map(d => ({
    title: d.title,
    category: d.category,
    createdAt: d.createdAt,
  }))

  // ─── Study logs this week ───────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const weekLogs = await db.dailyStudyLogs
    .where('id')
    .between(`${examProfileId}:${weekAgo}`, `${examProfileId}:${today}`)
    .toArray()
  const studyMinutesThisWeek = weekLogs.reduce((s, l) => s + Math.round(l.totalSeconds / 60), 0)
  const questionsAnsweredThisWeek = weekLogs.reduce((s, l) => s + l.questionsAnswered, 0)

  // ─── Due flashcards ─────────────────────────────────────────────
  let dueFlashcardCount = 0
  try {
    const decks = await db.flashcardDecks.where('examProfileId').equals(examProfileId).toArray()
    const deckIds = new Set(decks.map(d => d.id))
    dueFlashcardCount = await db.flashcards
      .where('nextReviewDate')
      .belowOrEqual(today)
      .filter(c => deckIds.has(c.deckId))
      .count()
  } catch { /* ignore */ }

  // ─── Weak topics (knowledge graph) ──────────────────────────────
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const weakTopics = topics
    .filter(t => t.mastery < 0.4 && t.questionsAttempted > 0)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 5)
    .map(t => ({ name: t.name, mastery: t.mastery, questionsAttempted: t.questionsAttempted }))

  // ─── Recent Oracle questions ────────────────────────────────────
  let recentOracleQuestions: string[] = []
  try {
    const convs = await db.conversations
      .where('examProfileId')
      .equals(examProfileId)
      .reverse()
      .sortBy('updatedAt')
    const recentConv = convs[0]
    if (recentConv) {
      const msgs = await db.chatMessages
        .where('conversationId')
        .equals(recentConv.id)
        .and(m => m.role === 'user')
        .toArray()
      recentOracleQuestions = msgs.slice(-3).map(m => m.content.slice(0, 100))
    }
  } catch { /* ignore */ }

  return {
    totalExercises: rows.length,
    totalGraded: allGraded.length,
    overallAvgScore: allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null,
    daysSinceLastActivity,
    inProgress,
    byType,
    topWeakAxes,
    streakDays,
    daysUntilExam,
    documents: recentDocs,
    studyMinutesThisWeek,
    questionsAnsweredThisWeek,
    dueFlashcardCount,
    weakTopics,
    recentOracleQuestions,
  }
}

/**
 * Format companion context as a compact text block for the AI prompt.
 */
export function formatCompanionContext(ctx: CompanionContext, studentName?: string | null): string {
  const lines: string[] = []

  if (studentName) lines.push(`Élève: ${studentName}`)
  if (ctx.daysUntilExam !== null) lines.push(`Jours avant l'écrit: ${ctx.daysUntilExam}`)
  lines.push(`Série: ${ctx.streakDays} jour${ctx.streakDays > 1 ? 's' : ''} consécutif${ctx.streakDays > 1 ? 's' : ''}`)
  lines.push(`Exercices réalisés: ${ctx.totalExercises} (${ctx.totalGraded} corrigés)`)
  if (ctx.overallAvgScore !== null) lines.push(`Moyenne générale: ${ctx.overallAvgScore.toFixed(1)}/20`)

  if (ctx.inProgress) {
    lines.push(`\nEN COURS: ${TYPE_LABELS[ctx.inProgress.type]} — "${ctx.inProgress.title}"`)
  }

  if (ctx.byType.some(t => t.count > 0)) {
    lines.push('\nBILAN PAR TYPE:')
    for (const t of ctx.byType) {
      if (t.count === 0) continue
      const scoreStr = t.avgScore !== null ? ` — moy. ${t.avgScore.toFixed(1)}/${t.maxScore}` : ''
      lines.push(`- ${TYPE_LABELS[t.type]}: ${t.count} fait${t.count > 1 ? 's' : ''}${scoreStr}`)
      for (const w of t.weakAxes) {
        lines.push(`  → axe à travailler: ${w.axis} (moy. ${w.avgScore.toFixed(1)}/5)`)
      }
    }
  }

  if (ctx.topWeakAxes.length > 0) {
    lines.push('\nERREURS RÉCURRENTES:')
    for (const w of ctx.topWeakAxes) {
      lines.push(`- ${w.axis} (${TYPE_LABELS[w.type]}) — ${w.count} fois`)
    }
  }

  return lines.join('\n')
}
