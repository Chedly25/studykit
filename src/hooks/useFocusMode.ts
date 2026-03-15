import { useState, useCallback, useEffect, useRef } from 'react'
import { useStudySession } from './useStudySession'

export type FocusPhase = 'work' | 'short-break' | 'long-break'

interface FocusModeSettings {
  workDuration: number // seconds
  shortBreakDuration: number
  longBreakDuration: number
  longBreakInterval: number
  selectedSubjectId?: string
  selectedTopicId?: string
}

const DEFAULT_SETTINGS: FocusModeSettings = {
  workDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  longBreakInterval: 4,
}

export function useFocusMode(examProfileId: string | undefined) {
  const [settings, setSettings] = useState<FocusModeSettings>(DEFAULT_SETTINGS)
  const [phase, setPhase] = useState<FocusPhase>('work')
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SETTINGS.workDuration)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { startSession, endSession } = useStudySession(examProfileId)

  const getDuration = useCallback((p: FocusPhase): number => {
    switch (p) {
      case 'work': return settings.workDuration
      case 'short-break': return settings.shortBreakDuration
      case 'long-break': return settings.longBreakDuration
    }
  }, [settings])

  // Timer tick
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Phase complete
          if (phase === 'work') {
            endSession()
            const newCount = sessionsCompleted + 1
            setSessionsCompleted(newCount)
            if (newCount % settings.longBreakInterval === 0) {
              setPhase('long-break')
              return settings.longBreakDuration
            } else {
              setPhase('short-break')
              return settings.shortBreakDuration
            }
          } else {
            // Break complete, start work
            setPhase('work')
            startSession('pomodoro', settings.selectedSubjectId, settings.selectedTopicId)
            return settings.workDuration
          }
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, phase, sessionsCompleted, settings, startSession, endSession])

  const start = useCallback(() => {
    if (phase === 'work') {
      startSession('pomodoro', settings.selectedSubjectId, settings.selectedTopicId)
    }
    setIsRunning(true)
  }, [phase, settings, startSession])

  const pause = useCallback(() => {
    setIsRunning(false)
  }, [])

  const reset = useCallback(() => {
    setIsRunning(false)
    if (phase === 'work') endSession()
    setTimeLeft(getDuration(phase))
  }, [phase, getDuration, endSession])

  const skip = useCallback(() => {
    setIsRunning(false)
    if (phase === 'work') {
      endSession()
      const newCount = sessionsCompleted + 1
      setSessionsCompleted(newCount)
      if (newCount % settings.longBreakInterval === 0) {
        setPhase('long-break')
        setTimeLeft(settings.longBreakDuration)
      } else {
        setPhase('short-break')
        setTimeLeft(settings.shortBreakDuration)
      }
    } else {
      setPhase('work')
      setTimeLeft(settings.workDuration)
    }
  }, [phase, sessionsCompleted, settings, endSession])

  const updateSettings = useCallback((partial: Partial<FocusModeSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial }
      if (!isRunning) {
        if (partial.workDuration && phase === 'work') setTimeLeft(partial.workDuration)
        if (partial.shortBreakDuration && phase === 'short-break') setTimeLeft(partial.shortBreakDuration)
        if (partial.longBreakDuration && phase === 'long-break') setTimeLeft(partial.longBreakDuration)
      }
      return next
    })
  }, [isRunning, phase])

  return {
    phase,
    timeLeft,
    isRunning,
    sessionsCompleted,
    settings,
    start,
    pause,
    reset,
    skip,
    updateSettings,
  }
}
