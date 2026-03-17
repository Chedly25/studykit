/**
 * Pure async utility to record study activity from any surface.
 * Replaces the need for startSession/endSession pairs when elapsed time is already known.
 */
import { db } from '../db'
import type { SessionType, DailyStudyLog } from '../db/schema'

export async function recordStudyActivity(params: {
  examProfileId: string
  durationSeconds: number
  subjectId?: string
  type: SessionType
}): Promise<void> {
  const { examProfileId, durationSeconds, subjectId, type } = params
  if (durationSeconds <= 0) return

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const logId = `${examProfileId}:${today}`

  // Create a StudySession row so it appears in session history
  const sessionId = crypto.randomUUID()
  const endTime = now.toISOString()
  const startTime = new Date(now.getTime() - durationSeconds * 1000).toISOString()

  await db.studySessions.put({
    id: sessionId,
    examProfileId,
    subjectId,
    startTime,
    endTime,
    durationSeconds,
    type,
  })

  // Update or create DailyStudyLog
  const existingLog = await db.dailyStudyLogs.get(logId)
  if (existingLog) {
    const breakdown = [...existingLog.subjectBreakdown]
    if (subjectId) {
      const idx = breakdown.findIndex(b => b.subjectId === subjectId)
      if (idx >= 0) {
        breakdown[idx] = { ...breakdown[idx], seconds: breakdown[idx].seconds + durationSeconds }
      } else {
        breakdown.push({ subjectId, seconds: durationSeconds })
      }
    }
    await db.dailyStudyLogs.update(logId, {
      totalSeconds: existingLog.totalSeconds + durationSeconds,
      subjectBreakdown: breakdown,
    })
  } else {
    const log: DailyStudyLog = {
      id: logId,
      examProfileId,
      date: today,
      totalSeconds: durationSeconds,
      subjectBreakdown: subjectId
        ? [{ subjectId, seconds: durationSeconds }]
        : [],
      questionsAnswered: 0,
      questionsCorrect: 0,
    }
    await db.dailyStudyLogs.put(log)
  }
}
