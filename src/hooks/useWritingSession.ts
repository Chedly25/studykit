import { useCallback, useRef, useState } from 'react'
import { db } from '../db'
import type { DailyStudyLog } from '../db/schema'

export function useWritingSession(examProfileId: string | undefined) {
  const [isActive, setIsActive] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const startTimeRef = useRef(0)
  const startWordCountRef = useRef(0)

  const startSession = useCallback(async (initialWordCount: number) => {
    if (!examProfileId) return
    const id = crypto.randomUUID()
    startTimeRef.current = Date.now()
    startWordCountRef.current = initialWordCount
    setSessionId(id)
    setIsActive(true)

    // Also create a study session record
    await db.studySessions.put({
      id,
      examProfileId,
      startTime: new Date().toISOString(),
      durationSeconds: 0,
      type: 'writing',
    })
  }, [examProfileId])

  const endSession = useCallback(async (finalWordCount: number) => {
    if (!sessionId || !examProfileId) return
    const now = new Date()
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000)

    // Save writing session
    await db.writingSessions.put({
      id: crypto.randomUUID(),
      examProfileId,
      wordCountStart: startWordCountRef.current,
      wordCountEnd: finalWordCount,
      durationSeconds,
      createdAt: now.toISOString(),
    })

    // Update study session
    await db.studySessions.update(sessionId, {
      endTime: now.toISOString(),
      durationSeconds,
    })

    // Update daily study log
    const today = now.toISOString().slice(0, 10)
    const logId = `${examProfileId}:${today}`
    const existingLog = await db.dailyStudyLogs.get(logId)
    if (existingLog) {
      await db.dailyStudyLogs.update(logId, {
        totalSeconds: existingLog.totalSeconds + durationSeconds,
      })
    } else {
      const log: DailyStudyLog = {
        id: logId,
        examProfileId,
        date: today,
        totalSeconds: durationSeconds,
        subjectBreakdown: [],
        questionsAnswered: 0,
        questionsCorrect: 0,
      }
      await db.dailyStudyLogs.put(log)
    }

    setIsActive(false)
    setSessionId(null)
    startTimeRef.current = 0

    return {
      wordsWritten: finalWordCount - startWordCountRef.current,
      durationSeconds,
    }
  }, [sessionId, examProfileId])

  return {
    isActive,
    startSession,
    endSession,
    startWordCount: startWordCountRef.current,
  }
}
