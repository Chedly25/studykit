/**
 * Full data export/import + progress report generation.
 */
import { db } from '../db'

interface ExportData {
  version: 1
  exportedAt: string
  profile: Record<string, unknown>
  tables: Record<string, Record<string, unknown>[]>
}

// Whitelist of tables that can be imported — must match what exportProfileData exports
const IMPORTABLE_TABLES = new Set([
  'subjects', 'chapters', 'topics', 'subtopics', 'studySessions',
  'questionResults', 'documents', 'documentChunks', 'dailyStudyLogs',
  'notifications', 'conceptCards', 'exercises', 'exerciseAttempts',
  'examSources', 'masterySnapshots', 'pdfHighlights', 'flashcardDecks',
  'flashcards', 'tutorPreferences', 'studentModels',
  'notificationPreferences', 'documentFiles',
  // Previously missing profile-scoped tables
  'conversations', 'chatMessages', 'chatFeedback', 'conversationSummaries',
  'studyPlans', 'studyPlanDays',
  'practiceExamSessions', 'generatedQuestions', 'examFormats',
  'revisionFiches', 'examDNA', 'misconceptions',
  'agentInsights', 'agentRuns',
  'achievements', 'mockExams',
  'macroRoadmaps',
  'habitGoals', 'habitLogs',
  'reviewProjects', 'reviewArticles',
  'annotations', 'contentEffectiveness',
  'tutoringEpisodes',
  'milestones', 'researchNotes', 'writingSessions', 'advisorMeetings',
])

function validateExportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (d.version !== 1) return false
  if (typeof d.exportedAt !== 'string') return false
  if (!d.profile || typeof d.profile !== 'object') return false
  if (!d.tables || typeof d.tables !== 'object') return false

  const profile = d.profile as Record<string, unknown>
  if (!profile.id || typeof profile.id !== 'string') return false
  if (!profile.name || typeof profile.name !== 'string') return false

  for (const [tableName, records] of Object.entries(d.tables as Record<string, unknown>)) {
    if (!IMPORTABLE_TABLES.has(tableName)) return false
    if (!Array.isArray(records)) return false
    for (const record of records) {
      if (!record || typeof record !== 'object') return false
      if (!('id' in record)) return false
    }
  }
  return true
}

/**
 * Export all data for an exam profile as a JSON blob.
 */
export async function exportProfileData(examProfileId: string): Promise<Blob> {
  const profile = await db.examProfiles.get(examProfileId)

  const tables: Record<string, any[]> = {}

  // All profile-scoped tables
  tables.subjects = await db.subjects.where('examProfileId').equals(examProfileId).toArray()
  tables.chapters = await db.chapters.where('examProfileId').equals(examProfileId).toArray()
  tables.topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  tables.subtopics = await db.subtopics.where('examProfileId').equals(examProfileId).toArray()
  tables.studySessions = await db.studySessions.where('examProfileId').equals(examProfileId).toArray()
  tables.questionResults = await db.questionResults.where('examProfileId').equals(examProfileId).toArray()
  tables.documents = await db.documents.where('examProfileId').equals(examProfileId).toArray()
  tables.documentChunks = await db.documentChunks.where('examProfileId').equals(examProfileId).toArray()
  tables.dailyStudyLogs = await db.dailyStudyLogs.where('examProfileId').equals(examProfileId).toArray()
  tables.notifications = await db.notifications.where('examProfileId').equals(examProfileId).toArray()
  tables.conceptCards = await db.conceptCards.where('examProfileId').equals(examProfileId).toArray()
  tables.exercises = await db.exercises.where('examProfileId').equals(examProfileId).toArray()
  tables.exerciseAttempts = await db.exerciseAttempts.where('examProfileId').equals(examProfileId).toArray()
  tables.examSources = await db.examSources.where('examProfileId').equals(examProfileId).toArray()
  tables.masterySnapshots = await db.masterySnapshots.where('examProfileId').equals(examProfileId).toArray()
  tables.pdfHighlights = await db.pdfHighlights.where('examProfileId').equals(examProfileId).toArray()

  // Flashcard decks + cards
  const decks = await db.flashcardDecks.where('examProfileId').equals(examProfileId).toArray()
  tables.flashcardDecks = decks
  const deckIds = decks.map(d => d.id)
  if (deckIds.length > 0) {
    tables.flashcards = await db.flashcards.where('deckId').anyOf(deckIds).toArray()
  } else {
    tables.flashcards = []
  }

  // Related records
  tables.tutorPreferences = await db.tutorPreferences.where('examProfileId').equals(examProfileId).toArray()
  tables.studentModels = await db.studentModels.where('examProfileId').equals(examProfileId).toArray()
  tables.notificationPreferences = await db.notificationPreferences.where('examProfileId').equals(examProfileId).toArray()

  // Chat & conversations
  tables.conversations = await db.conversations.where('examProfileId').equals(examProfileId).toArray()
  const convIds = tables.conversations.map((c: Record<string, unknown>) => c.id as string)
  tables.chatMessages = convIds.length > 0
    ? await db.chatMessages.where('conversationId').anyOf(convIds).toArray()
    : []
  tables.chatFeedback = await db.chatFeedback.where('examProfileId').equals(examProfileId).toArray()
  tables.conversationSummaries = await db.conversationSummaries.where('examProfileId').equals(examProfileId).toArray()

  // Study plans
  tables.studyPlans = await db.studyPlans.where('examProfileId').equals(examProfileId).toArray()
  const planIds = tables.studyPlans.map((p: Record<string, unknown>) => p.id as string)
  tables.studyPlanDays = planIds.length > 0
    ? await db.studyPlanDays.where('planId').anyOf(planIds).toArray()
    : []

  // Exams
  tables.practiceExamSessions = await db.practiceExamSessions.where('examProfileId').equals(examProfileId).toArray()
  const sessionIds = tables.practiceExamSessions.map((s: Record<string, unknown>) => s.id as string)
  tables.generatedQuestions = sessionIds.length > 0
    ? await db.generatedQuestions.where('sessionId').anyOf(sessionIds).toArray()
    : []
  tables.examFormats = await db.examFormats.where('examProfileId').equals(examProfileId).toArray()

  // Knowledge artifacts
  tables.revisionFiches = await db.revisionFiches.where('examProfileId').equals(examProfileId).toArray()
  tables.examDNA = await db.examDNA.where('examProfileId').equals(examProfileId).toArray()
  tables.misconceptions = await db.misconceptions.where('examProfileId').equals(examProfileId).toArray()

  // Agent data
  tables.agentInsights = await db.agentInsights.where('examProfileId').equals(examProfileId).toArray()
  tables.agentRuns = await db.agentRuns.where('[examProfileId+agentId]').between([examProfileId, ''], [examProfileId, '\uffff']).toArray()

  // Achievements
  tables.achievements = await db.achievements.where('examProfileId').equals(examProfileId).toArray()

  // Mock exams
  tables.mockExams = await db.mockExams.where('examProfileId').equals(examProfileId).toArray()

  // Other profile-scoped tables
  tables.macroRoadmaps = await db.macroRoadmaps.where('examProfileId').equals(examProfileId).toArray()
  tables.habitGoals = await db.habitGoals.where('examProfileId').equals(examProfileId).toArray()
  tables.habitLogs = await db.habitLogs.where('examProfileId').equals(examProfileId).toArray()
  tables.reviewProjects = await db.reviewProjects.where('examProfileId').equals(examProfileId).toArray()
  const rpIds = tables.reviewProjects.map((r: Record<string, unknown>) => r.id as string)
  tables.reviewArticles = rpIds.length > 0
    ? await db.reviewArticles.where('projectId').anyOf(rpIds).toArray()
    : []
  tables.annotations = await db.annotations.where('examProfileId').equals(examProfileId).toArray()
  tables.contentEffectiveness = await db.contentEffectiveness.where('[examProfileId+contentType]').between([examProfileId, ''], [examProfileId, '\uffff']).toArray()
  tables.tutoringEpisodes = await db.tutoringEpisodes.filter(e => e.examProfileId === examProfileId).toArray()

  // Research mode tables
  tables.milestones = await db.milestones.where('examProfileId').equals(examProfileId).toArray()
  tables.researchNotes = await db.researchNotes.where('examProfileId').equals(examProfileId).toArray()
  tables.writingSessions = await db.writingSessions.where('examProfileId').equals(examProfileId).toArray()
  tables.advisorMeetings = await db.advisorMeetings.where('examProfileId').equals(examProfileId).toArray()

  // DocumentFiles — convert Blob to base64
  const docFiles = await db.documentFiles.where('examProfileId').equals(examProfileId).toArray()
  tables.documentFiles = await Promise.all(
    docFiles.map(async (df) => {
      try {
        const base64 = await blobToBase64(df.file)
        return { ...df, file: base64, _isBase64: true }
      } catch {
        return { ...df, file: null, _isBase64: true }
      }
    })
  )

  const exportData: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile as unknown as Record<string, unknown>,
    tables,
  }

  return new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
}

/**
 * Import profile data from a JSON file.
 */
export async function importProfileData(file: File): Promise<{ success: boolean; error?: string }> {
  try {
    const text = await file.text()
    const raw = JSON.parse(text)

    if (!validateExportData(raw)) {
      return { success: false, error: 'Invalid or corrupt export file. Required fields are missing or unknown tables detected.' }
    }

    const data = raw as ExportData

    // Import profile
    if (data.profile) {
      const p = data.profile as Record<string, unknown>
      if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') {
        return { success: false, error: 'Invalid profile data' }
      }
      await db.examProfiles.put(data.profile as any)
    }

    // Import validated tables only
    for (const [tableName, records] of Object.entries(data.tables)) {
      if (!records || records.length === 0) continue
      if (!IMPORTABLE_TABLES.has(tableName)) continue

      if (tableName === 'documentFiles') {
        // Decode base64 back to Blob
        for (const record of records as any[]) {
          if (!record || typeof record !== 'object' || typeof record.id !== 'string') continue
          if (record._isBase64 && record.file) {
            try {
              record.file = base64ToBlob(record.file)
            } catch {
              continue
            }
          }
          delete record._isBase64
          const table = (db as any)[tableName]
          if (table) await table.put(record)
        }
      } else {
        const table = (db as any)[tableName]
        if (table) {
          const validRecords = (records as Array<Record<string, unknown>>).filter(
            r => r && typeof r === 'object' && typeof r.id === 'string'
          )
          await table.bulkPut(validRecords)
        }
      }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Import failed' }
  }
}

/**
 * Generate a progress report as a markdown file.
 */
export async function generateProgressReport(examProfileId: string): Promise<Blob> {
  const profile = await db.examProfiles.get(examProfileId)
  const subjects = await db.subjects.where('examProfileId').equals(examProfileId).sortBy('order')
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const dailyLogs = await db.dailyStudyLogs.where('examProfileId').equals(examProfileId).toArray()
  const questionResults = await db.questionResults.where('examProfileId').equals(examProfileId).toArray()
  const exerciseAttempts = await db.exerciseAttempts.where('examProfileId').equals(examProfileId).toArray()

  const totalStudyHours = dailyLogs.reduce((sum, l) => sum + l.totalSeconds, 0) / 3600
  const totalQuestions = questionResults.length
  const correctQuestions = questionResults.filter(q => q.isCorrect).length
  const accuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0

  // Streak
  const sortedLogs = [...dailyLogs].sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0
  if (sortedLogs.length > 0) {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (sortedLogs[0].date === today || sortedLogs[0].date === yesterday) {
      streak = 1
      for (let i = 1; i < sortedLogs.length; i++) {
        const prev = new Date(sortedLogs[i - 1].date)
        const curr = new Date(sortedLogs[i].date)
        const diff = (prev.getTime() - curr.getTime()) / 86400000
        if (Math.abs(diff - 1) < 0.1) streak++
        else break
      }
    }
  }

  let md = `# Study Progress Report\n\n`
  md += `**Profile:** ${profile?.name ?? 'Unknown'}\n`
  md += `**Generated:** ${new Date().toLocaleDateString()}\n`
  if (profile?.examDate) md += `**Exam Date:** ${profile.examDate}\n`
  md += `\n---\n\n`

  md += `## Summary\n\n`
  md += `- **Study Hours:** ${totalStudyHours.toFixed(1)} hours\n`
  md += `- **Questions Answered:** ${totalQuestions}\n`
  md += `- **Accuracy:** ${accuracy}%\n`
  md += `- **Exercises Attempted:** ${exerciseAttempts.length}\n`
  md += `- **Current Streak:** ${streak} days\n`
  md += `\n`

  md += `## Subjects\n\n`
  md += `| Subject | Weight | Mastery |\n`
  md += `|---------|--------|---------|\n`
  for (const s of subjects) {
    md += `| ${s.name} | ${s.weight}% | ${Math.round(s.mastery * 100)}% |\n`
  }
  md += `\n`

  md += `## Topics\n\n`
  md += `| Topic | Mastery | Questions | Correct |\n`
  md += `|-------|---------|-----------|----------|\n`
  for (const t of topics.sort((a, b) => a.mastery - b.mastery)) {
    md += `| ${t.name} | ${Math.round(t.mastery * 100)}% | ${t.questionsAttempted} | ${t.questionsCorrect} |\n`
  }

  return new Blob([md], { type: 'text/markdown' })
}

// ─── Helpers ──────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
  const bstr = atob(parts[1])
  const arr = new Uint8Array(bstr.length)
  for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/**
 * Trigger a browser download for a Blob.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Anki Export ─────────────────────────────────────────────────

function escapeAnkiField(s: string): string {
  // Anki uses tab-separated; escape tabs and newlines within fields
  return s.replace(/\t/g, '    ').replace(/\n/g, '<br>')
}

/**
 * Export flashcards for a deck in Anki-compatible tab-separated format.
 * Each line: front\tback
 * Import in Anki via File > Import > select the .txt file.
 */
export async function exportFlashcardsAnki(deckId: string): Promise<Blob> {
  const cards = await db.flashcards.where('deckId').equals(deckId).toArray()
  const lines = cards.map(c => `${escapeAnkiField(c.front)}\t${escapeAnkiField(c.back)}`)
  return new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
}

// ─── CSV Export ──────────────────────────────────────────────────

function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(f => {
    const s = String(f ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }).join(',')
}

/**
 * Export study sessions, question results, and mastery snapshots as CSV.
 */
export async function exportStudyDataCSV(examProfileId: string): Promise<Blob> {
  const sessions = await db.studySessions.where('examProfileId').equals(examProfileId).toArray()
  const questions = await db.questionResults.where('examProfileId').equals(examProfileId).toArray()
  const snapshots = await db.masterySnapshots.where('examProfileId').equals(examProfileId).toArray()
  const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
  const topicMap = new Map(topics.map(t => [t.id, t.name]))

  const lines: string[] = []

  // Sessions
  lines.push('# Study Sessions')
  lines.push(csvRow(['id', 'type', 'startTime', 'endTime', 'durationSeconds', 'subjectId', 'topicId']))
  for (const s of sessions) {
    lines.push(csvRow([s.id, s.type, s.startTime, s.endTime, s.durationSeconds, s.subjectId ?? '', s.topicId ?? '']))
  }

  lines.push('')
  lines.push('# Question Results')
  lines.push(csvRow(['id', 'topicId', 'topicName', 'isCorrect', 'difficulty', 'format', 'timestamp']))
  for (const q of questions) {
    lines.push(csvRow([q.id, q.topicId, topicMap.get(q.topicId) ?? '', q.isCorrect ? '1' : '0', q.difficulty ?? '', q.format ?? '', q.timestamp]))
  }

  lines.push('')
  lines.push('# Mastery Snapshots')
  lines.push(csvRow(['topicId', 'topicName', 'date', 'mastery']))
  for (const m of snapshots) {
    lines.push(csvRow([m.topicId, topicMap.get(m.topicId) ?? '', m.date, m.mastery]))
  }

  return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
}
