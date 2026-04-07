import { useCallback, useRef, useState } from 'react'
import { db } from '../db'
import type { SessionType, DailyStudyLog } from '../db/schema'

export function useStudySession(examProfileId: string | undefined) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const startTimeRef = useRef<number>(0)
  const endingRef = useRef(false)

  const startSession = useCallback(async (
    type: SessionType,
    subjectId?: string,
    topicId?: string
  ): Promise<string | null> => {
    if (!examProfileId) return null

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.studySessions.put({
      id,
      examProfileId,
      subjectId,
      topicId,
      startTime: now,
      durationSeconds: 0,
      type,
    })

    startTimeRef.current = Date.now()
    setActiveSessionId(id)
    return id
  }, [examProfileId])

  const endSession = useCallback(async (): Promise<void> => {
    if (!activeSessionId || !examProfileId || endingRef.current) return
    endingRef.current = true

    const now = new Date()
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000)

    await db.studySessions.update(activeSessionId, {
      endTime: now.toISOString(),
      durationSeconds,
    })

    // Update daily study log
    const today = now.toISOString().slice(0, 10)
    const logId = `${examProfileId}:${today}`
    const session = await db.studySessions.get(activeSessionId)

    const existingLog = await db.dailyStudyLogs.get(logId)
    if (existingLog) {
      const breakdown = [...existingLog.subjectBreakdown]
      if (session?.subjectId) {
        const idx = breakdown.findIndex(b => b.subjectId === session.subjectId)
        if (idx >= 0) {
          breakdown[idx] = { ...breakdown[idx], seconds: breakdown[idx].seconds + durationSeconds }
        } else {
          breakdown.push({ subjectId: session.subjectId, seconds: durationSeconds })
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
        subjectBreakdown: session?.subjectId
          ? [{ subjectId: session.subjectId, seconds: durationSeconds }]
          : [],
        questionsAnswered: 0,
        questionsCorrect: 0,
      }
      await db.dailyStudyLogs.put(log)
    }

    setActiveSessionId(null)
    startTimeRef.current = 0
    endingRef.current = false
  }, [activeSessionId, examProfileId])

  return {
    activeSessionId,
    startSession,
    endSession,
    isSessionActive: activeSessionId !== null,
  }
}
