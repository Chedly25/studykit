/**
 * State machine hook for the practice exam lifecycle.
 * Phases: setup → generating → taking → grading → results
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '@clerk/clerk-react'
import { db } from '../db'
import type { GeneratedQuestion, PracticeExamSession } from '../db/schema'
import { useOrchestrator } from './useOrchestrator'
import { createPracticeExamWorkflow } from '../ai/workflows/practiceExam'
import { createGradingWorkflow } from '../ai/workflows/practiceExamGrading'
import { createAdaptiveState, updateAdaptiveState, getNextQuestionIndex, type AdaptiveState } from '../lib/adaptiveDifficulty'
import { recordStudyActivity } from '../lib/studyActivity'

export type PracticePhase = 'setup' | 'generating' | 'taking' | 'grading' | 'results'

export interface PracticeExamOptions {
  questionCount: number
  focusSubject?: string
  selectedTopics?: string[]
  customFocus?: string
  examSection?: string
  sourcesEnabled: boolean
  timeLimitSeconds?: number
}

export function usePracticeExam(examProfileId: string | undefined) {
  const { getToken } = useAuth()
  const [phase, setPhase] = useState<PracticePhase>('setup')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [timerActive, setTimerActive] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [adaptiveState, setAdaptiveState] = useState<AdaptiveState>(createAdaptiveState)

  // Destructure stable refs from orchestrator hooks to avoid re-render churn
  const {
    run: runGeneration,
    cancel: cancelGeneration,
    isRunning: isGenerating,
    progress: generationProgress,
    error: generationError,
  } = useOrchestrator<GeneratedQuestion[]>()

  const {
    run: runGrading,
    isRunning: isGrading,
    progress: gradingProgress,
    error: gradingError,
  } = useOrchestrator<{ grades: Array<{ questionId: string; isCorrect: boolean; earnedPoints: number; feedback: string }>; totalScore: number; maxScore: number }>()

  // Live query for questions
  const questions = useLiveQuery(
    () => sessionId
      ? db.generatedQuestions.where('sessionId').equals(sessionId).sortBy('questionIndex')
      : Promise.resolve([] as GeneratedQuestion[]),
    [sessionId],
  ) ?? []

  // Live query for session
  const session = useLiveQuery(
    () => sessionId ? db.practiceExamSessions.get(sessionId) : undefined,
    [sessionId],
  )

  // Timer effect
  useEffect(() => {
    if (!timerActive || timeRemaining === null || timeRemaining <= 0) return
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!)
          setTimerActive(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerActive])

  // Use ref for submitExam to avoid stale closure in auto-submit effect
  const submitExamRef = useRef<() => void>(() => {})

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeRemaining === 0 && phase === 'taking') {
      submitExamRef.current()
    }
  }, [timeRemaining, phase])

  const startGeneration = useCallback(async (options: PracticeExamOptions) => {
    if (!examProfileId) return

    const token = await getToken()
    if (!token) return

    const id = crypto.randomUUID()
    const newSession: PracticeExamSession = {
      id,
      examProfileId,
      phase: 'generating',
      questionCount: options.questionCount,
      focusSubject: options.focusSubject,
      examSection: options.examSection,
      sourcesEnabled: options.sourcesEnabled,
      timeLimitSeconds: options.timeLimitSeconds,
      createdAt: new Date().toISOString(),
    }
    await db.practiceExamSessions.put(newSession)
    setSessionId(id)
    setPhase('generating')
    setAnswers(new Map())
    setCurrentQuestionIndex(0)
    setAdaptiveState(createAdaptiveState())

    const workflow = createPracticeExamWorkflow({
      sessionId: id,
      questionCount: options.questionCount,
      focusSubject: options.focusSubject,
      selectedTopics: options.selectedTopics,
      customFocus: options.customFocus,
      examSection: options.examSection,
      sourcesEnabled: options.sourcesEnabled,
    })

    const result = await runGeneration(workflow, { examProfileId, authToken: token })

    if (result?.success) {
      setPhase('taking')
      await db.practiceExamSessions.update(id, { phase: 'in-progress', startedAt: new Date().toISOString() })
      if (options.timeLimitSeconds) {
        setTimeRemaining(options.timeLimitSeconds)
        setTimerActive(true)
      }
    }
  }, [examProfileId, getToken, runGeneration])

  const answerQuestion = useCallback((questionId: string, answer: string) => {
    setAnswers(prev => {
      const next = new Map(prev)
      next.set(questionId, answer)
      return next
    })

    // Update adaptive state for MCQ/T-F (client-side checkable)
    const question = questions.find(q => q.id === questionId)
    if (question && (question.format === 'multiple-choice' || question.format === 'true-false')) {
      const isCorrect = question.correctOptionIndex !== undefined
        ? String(question.correctOptionIndex) === answer || question.correctAnswer?.toLowerCase() === answer?.toLowerCase()
        : question.correctAnswer?.toLowerCase() === answer?.toLowerCase()

      setAdaptiveState(prev => updateAdaptiveState(prev, isCorrect, question.questionIndex))
    }
  }, [questions])

  const goToQuestion = useCallback((index: number) => {
    setCurrentQuestionIndex(index)
  }, [])

  const goToNextAdaptive = useCallback(() => {
    if (questions.length === 0) return
    const nextIdx = getNextQuestionIndex(questions, adaptiveState, currentQuestionIndex)
    if (nextIdx === -1) return // All answered — caller can check via answers.size
    setCurrentQuestionIndex(nextIdx)
  }, [questions, adaptiveState, currentQuestionIndex])

  const submitExam = useCallback(async () => {
    if (!sessionId || !examProfileId) return
    setTimerActive(false)
    if (timerRef.current) clearInterval(timerRef.current)

    // Flush all answers to DB
    for (const [qId, answer] of answers) {
      await db.generatedQuestions.update(qId, { userAnswer: answer, isAnswered: true })
    }

    setPhase('grading')
    await db.practiceExamSessions.update(sessionId, { phase: 'grading' })

    const token = await getToken()
    if (!token) return

    const workflow = createGradingWorkflow({ sessionId })
    const result = await runGrading(workflow, { examProfileId, authToken: token })

    if (result?.success) {
      setPhase('results')

      // Record study activity with actual exam duration
      const completedSession = await db.practiceExamSessions.get(sessionId)
      if (completedSession?.startedAt) {
        const startedAt = new Date(completedSession.startedAt).getTime()
        const completedAt = completedSession.completedAt
          ? new Date(completedSession.completedAt).getTime()
          : Date.now()
        const durationSeconds = Math.round((completedAt - startedAt) / 1000)
        await recordStudyActivity({
          examProfileId,
          durationSeconds,
          type: 'practice-exam',
        })
      }
    }
  }, [sessionId, examProfileId, answers, getToken, runGrading])

  // Keep ref in sync
  submitExamRef.current = submitExam

  const resetToSetup = useCallback(() => {
    setPhase('setup')
    setSessionId(null)
    setCurrentQuestionIndex(0)
    setAnswers(new Map())
    setTimeRemaining(null)
    setTimerActive(false)
    setAdaptiveState(createAdaptiveState())
  }, [])

  return {
    phase,
    sessionId,
    session,
    questions,
    currentQuestionIndex,
    answers,
    timeRemaining,
    generationProgress,
    generationError,
    isGenerating,
    gradingProgress,
    gradingError,
    isGrading,
    startGeneration,
    answerQuestion,
    goToQuestion,
    goToNextAdaptive,
    submitExam,
    cancelGeneration,
    resetToSetup,
    adaptiveState,
  }
}
