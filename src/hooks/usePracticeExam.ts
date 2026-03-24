/**
 * State machine hook for the practice exam lifecycle.
 * Phases: setup → generating → taking → grading → results
 * Uses background job queue so generation/grading survive navigation.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { GeneratedQuestion, PracticeExamSession } from '../db/schema'
import { useBackgroundJobs } from '../components/BackgroundJobsProvider'
import { useBackgroundJob } from './useBackgroundJob'
import { createAdaptiveState, updateAdaptiveState, getNextQuestionIndex, type AdaptiveState } from '../lib/adaptiveDifficulty'
import { recordStudyActivity } from '../lib/studyActivity'

export type PracticePhase = 'setup' | 'generating' | 'taking' | 'grading' | 'results'

export interface SimulationSectionOption {
  examFormatId: string
  formatName: string
  sectionType: 'written' | 'oral' | 'practical'
  timeAllocationMinutes: number
  questionCount: number
  pointWeight: number
  questionFormat?: string
  samplePrompt?: string
  prepTimeMinutes?: number
}

export interface PracticeExamOptions {
  questionCount: number
  focusSubject?: string
  selectedTopics?: string[]
  customFocus?: string
  examSection?: string
  sourcesEnabled: boolean
  timeLimitSeconds?: number
  proctorMode?: boolean
  // Simulation mode
  simulationMode?: boolean
  sections?: SimulationSectionOption[]
  // Document exam mode (Type B — CPGE concours)
  examMode?: 'standard' | 'document'
  documentSubject?: string   // 'maths-algebre' | 'maths-analyse' | 'physique' | 'informatique'
  documentConcours?: string  // 'polytechnique' | 'mines' | 'centrale' | 'ccinp'
}

export function usePracticeExam(examProfileId: string | undefined) {
  const { enqueue, cancel } = useBackgroundJobs()
  const [phase, setPhase] = useState<PracticePhase>('setup')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [timerActive, setTimerActive] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [adaptiveState, setAdaptiveState] = useState<AdaptiveState>(createAdaptiveState)
  const [timeLimitForSession, setTimeLimitForSession] = useState<number | undefined>()
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set())

  // Per-question timing
  const questionStartTime = useRef<number>(Date.now())
  const questionTimes = useRef<Map<string, number>>(new Map())

  // Background job tracking
  const [genJobId, setGenJobId] = useState<string | null>(null)
  const [gradeJobId, setGradeJobId] = useState<string | null>(null)
  const genJob = useBackgroundJob(genJobId)
  const gradeJob = useBackgroundJob(gradeJobId)

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

  // Past graded sessions
  const pastSessions = useLiveQuery(
    () => examProfileId
      ? db.practiceExamSessions
          .where('examProfileId').equals(examProfileId)
          .filter(s => s.phase === 'graded')
          .toArray()
          .then(sessions => sessions.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')))
      : Promise.resolve([] as PracticeExamSession[]),
    [examProfileId],
  ) ?? []

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

  const submitExamRef = useRef<() => void>(() => {})

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeRemaining === 0 && phase === 'taking') {
      submitExamRef.current()
    }
  }, [timeRemaining, phase])

  // Transition to 'taking' when generation job completes
  useEffect(() => {
    if (genJob.isCompleted && phase === 'generating' && sessionId) {
      setPhase('taking')
      db.practiceExamSessions.update(sessionId, { phase: 'in-progress', startedAt: new Date().toISOString() })
      questionStartTime.current = Date.now()
      questionTimes.current = new Map()
      if (timeLimitForSession) {
        setTimeRemaining(timeLimitForSession)
        setTimerActive(true)
      }
    }
  }, [genJob.isCompleted, phase, sessionId, timeLimitForSession])

  // Transition to 'results' when grading job completes
  useEffect(() => {
    if (gradeJob.isCompleted && phase === 'grading' && sessionId && examProfileId) {
      setPhase('results')
      // Record study activity
      db.practiceExamSessions.get(sessionId).then(async completedSession => {
        if (completedSession?.startedAt) {
          const startedAt = new Date(completedSession.startedAt).getTime()
          const completedAt = completedSession.completedAt
            ? new Date(completedSession.completedAt).getTime()
            : Date.now()
          const durationSeconds = Math.round((completedAt - startedAt) / 1000)
          await recordStudyActivity({
            examProfileId: examProfileId!,
            durationSeconds,
            type: 'practice-exam',
          })
        }
      })
    }
  }, [gradeJob.isCompleted, phase, sessionId, examProfileId])

  const startGeneration = useCallback(async (options: PracticeExamOptions) => {
    if (!examProfileId) return

    const id = crypto.randomUUID()
    // Store section configs in sectionProgress so SimulationExamTaker can reconstruct on resume
    const sectionProgressData = options.simulationMode && options.sections
      ? JSON.stringify(options.sections.map(s => ({
          sectionId: s.examFormatId,
          formatName: s.formatName,
          sectionType: s.sectionType,
          timeAllocationMinutes: s.timeAllocationMinutes,
          questionCount: s.questionCount,
          prepTimeMinutes: s.prepTimeMinutes,
          instructions: s.instructions,
          shuffleQuestions: s.shuffleQuestions,
          canGoBack: s.canGoBack,
        })))
      : undefined

    const newSession: PracticeExamSession = {
      id,
      examProfileId,
      phase: 'generating',
      questionCount: options.questionCount,
      focusSubject: options.focusSubject,
      examSection: options.examSection,
      sourcesEnabled: options.sourcesEnabled,
      timeLimitSeconds: options.timeLimitSeconds,
      proctorMode: options.proctorMode || undefined,
      simulationMode: options.simulationMode || undefined,
      currentSectionIndex: options.simulationMode ? 0 : undefined,
      sectionProgress: sectionProgressData,
      examMode: options.examMode ?? 'standard',
      createdAt: new Date().toISOString(),
    }
    await db.practiceExamSessions.put(newSession)
    setSessionId(id)
    setPhase('generating')
    setAnswers(new Map())
    setCurrentQuestionIndex(0)
    setAdaptiveState(createAdaptiveState())
    // Document exams manage their own timer in DocumentExamTaker; simulation exams use per-section timers
    setTimeLimitForSession(
      (options.simulationMode || options.examMode === 'document') ? undefined : options.timeLimitSeconds
    )

    // Choose pipeline based on exam mode
    let jobType: string
    let jobConfig: Record<string, unknown>
    let totalSteps: number

    if (options.examMode === 'document') {
      // Type B: document exam (CPGE concours)
      jobType = 'document-exam-generation'
      jobConfig = {
        sessionId: id,
        subject: options.documentSubject ?? 'maths-algebre',
        concours: options.documentConcours ?? 'mines',
        sourcesEnabled: options.sourcesEnabled,
        timeLimitSeconds: options.timeLimitSeconds,
      }
      totalSteps = 4
    } else if (options.simulationMode) {
      jobType = 'exam-simulation'
      jobConfig = { sessionId: id, sourcesEnabled: options.sourcesEnabled, sections: options.sections }
      totalSteps = 7
    } else {
      jobType = 'practice-exam-generation'
      jobConfig = {
        sessionId: id,
        questionCount: options.questionCount,
        focusSubject: options.focusSubject,
        selectedTopics: options.selectedTopics,
        customFocus: options.customFocus,
        examSection: options.examSection,
        sourcesEnabled: options.sourcesEnabled,
        simulationMode: options.simulationMode,
        sections: options.sections,
      }
      totalSteps = 5
    }

    const jobId = await enqueue(jobType, examProfileId, jobConfig, totalSteps)
    setGenJobId(jobId)
  }, [examProfileId, enqueue])

  const answerQuestion = useCallback((questionId: string, answer: string) => {
    setAnswers(prev => {
      const next = new Map(prev)
      next.set(questionId, answer)
      return next
    })

    const question = questions.find(q => q.id === questionId)
    if (question && (question.format === 'multiple-choice' || question.format === 'true-false')) {
      const isCorrect = question.correctOptionIndex !== undefined
        ? String(question.correctOptionIndex) === answer || question.correctAnswer?.toLowerCase() === answer?.toLowerCase()
        : question.correctAnswer?.toLowerCase() === answer?.toLowerCase()

      setAdaptiveState(prev => updateAdaptiveState(prev, isCorrect, question.questionIndex))
    }
  }, [questions])

  const toggleFlag = useCallback((questionId: string) => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }, [])

  const flushCurrentQuestionTime = useCallback(() => {
    if (questions.length === 0) return
    const currentQ = questions[currentQuestionIndex]
    if (!currentQ) return
    const elapsed = Math.round((Date.now() - questionStartTime.current) / 1000)
    const prev = questionTimes.current.get(currentQ.id) ?? 0
    questionTimes.current.set(currentQ.id, prev + elapsed)
    questionStartTime.current = Date.now()
  }, [questions, currentQuestionIndex])

  const goToQuestion = useCallback((index: number) => {
    flushCurrentQuestionTime()
    setCurrentQuestionIndex(index)
    questionStartTime.current = Date.now()
  }, [flushCurrentQuestionTime])

  const goToNextAdaptive = useCallback(() => {
    if (questions.length === 0) return
    flushCurrentQuestionTime()
    const nextIdx = getNextQuestionIndex(questions, adaptiveState, currentQuestionIndex)
    if (nextIdx === -1) return
    setCurrentQuestionIndex(nextIdx)
    questionStartTime.current = Date.now()
  }, [questions, adaptiveState, currentQuestionIndex, flushCurrentQuestionTime])

  const submitExam = useCallback(async (proctorFlags?: { tabSwitches: number; fullscreenExits: number }) => {
    if (!sessionId || !examProfileId) return
    setTimerActive(false)
    if (timerRef.current) clearInterval(timerRef.current)

    // Flush per-question timing
    flushCurrentQuestionTime()

    // Flush all answers, flagged status, and timing to DB
    for (const [qId, answer] of answers) {
      await db.generatedQuestions.update(qId, {
        userAnswer: answer,
        isAnswered: true,
        flagged: flaggedQuestions.has(qId) || undefined,
        timeSpentSeconds: questionTimes.current.get(qId),
      })
    }
    // Also write flags + timing for questions that were flagged/timed but not answered
    for (const q of questions) {
      if (!answers.has(q.id)) {
        const updates: Record<string, unknown> = {}
        if (flaggedQuestions.has(q.id)) updates.flagged = true
        const time = questionTimes.current.get(q.id)
        if (time !== undefined) updates.timeSpentSeconds = time
        if (Object.keys(updates).length > 0) {
          await db.generatedQuestions.update(q.id, updates)
        }
      }
    }

    setPhase('grading')

    const sessionUpdate: Record<string, unknown> = { phase: 'grading' }
    if (proctorFlags) {
      sessionUpdate.proctorFlags = JSON.stringify(proctorFlags)
    }
    await db.practiceExamSessions.update(sessionId, sessionUpdate)

    const jobId = await enqueue(
      'practice-exam-grading',
      examProfileId,
      { sessionId },
      4, // grading workflow has ~4 steps
    )
    setGradeJobId(jobId)
  }, [sessionId, examProfileId, answers, enqueue, flushCurrentQuestionTime, flaggedQuestions, questions])

  submitExamRef.current = submitExam

  const reviewSession = useCallback((reviewSessionId: string) => {
    setSessionId(reviewSessionId)
    setPhase('results')
    setCurrentQuestionIndex(0)
    setAnswers(new Map())
  }, [])

  // Resume support: detect in-progress sessions
  const inProgressSession = useLiveQuery(
    () => examProfileId
      ? db.practiceExamSessions
          .where('examProfileId').equals(examProfileId)
          .filter(s => s.phase === 'in-progress')
          .first()
      : undefined,
    [examProfileId]
  )

  const resumeSession = useCallback((id: string) => {
    setSessionId(id)
    setPhase('taking')
    setAnswers(new Map())
    setCurrentQuestionIndex(0)
  }, [])

  const abandonSession = useCallback(async (id: string) => {
    // Mark as completed with 0 score to exclude from analytics but clear from in-progress detection
    await db.practiceExamSessions.update(id, {
      phase: 'graded' as PracticeExamSession['phase'],
      totalScore: 0,
      maxScore: 0,
      completedAt: new Date().toISOString(),
    })
  }, [])

  const updateSectionProgress = useCallback(async (sectionIndex: number) => {
    if (!sessionId) return
    await db.practiceExamSessions.update(sessionId, { currentSectionIndex: sectionIndex }).catch(() => {})
  }, [sessionId])

  // Document exam: answer change callback (no-op — useDocumentAutoSave handles persistence)
  const saveDocumentAnswer = useCallback((_questionNumber: number, _answer: string) => {
    // Auto-save hook in DocumentExamTaker handles debounced persistence to avoid race conditions
  }, [])

  // Document exam: submit (flush answers, trigger grading)
  const submitDocumentExam = useCallback(async () => {
    if (!sessionId || !examProfileId) return
    setTimerActive(false)
    if (timerRef.current) clearInterval(timerRef.current)

    setPhase('grading')
    await db.practiceExamSessions.update(sessionId, {
      phase: 'grading',
      completedAt: new Date().toISOString(),
    })

    const jobId = await enqueue(
      'document-exam-grading',
      examProfileId,
      { sessionId },
      3,
    )
    setGradeJobId(jobId)
  }, [sessionId, examProfileId, enqueue])

  const resetToSetup = useCallback(() => {
    setPhase('setup')
    setSessionId(null)
    setGenJobId(null)
    setGradeJobId(null)
    setCurrentQuestionIndex(0)
    setAnswers(new Map())
    setTimeRemaining(null)
    setTimerActive(false)
    setAdaptiveState(createAdaptiveState())
    setFlaggedQuestions(new Set())
    questionTimes.current = new Map()
  }, [])

  return {
    phase,
    sessionId,
    session,
    questions,
    currentQuestionIndex,
    answers,
    timeRemaining,
    generationProgress: genJob.job ? {
      workflowName: 'Generating exam',
      currentStepIndex: genJob.job.completedStepCount,
      totalSteps: genJob.job.totalSteps,
      currentStepName: genJob.currentStepName,
      completedSteps: genJob.job.completedStepCount,
      failedSteps: 0,
      isStreaming: false,
      streamedChars: 0,
    } : null,
    generationError: genJob.error,
    isGenerating: genJob.isRunning,
    gradingProgress: gradeJob.job ? {
      workflowName: 'Grading exam',
      currentStepIndex: gradeJob.job.completedStepCount,
      totalSteps: gradeJob.job.totalSteps,
      currentStepName: gradeJob.currentStepName,
      completedSteps: gradeJob.job.completedStepCount,
      failedSteps: 0,
      isStreaming: false,
      streamedChars: 0,
    } : null,
    gradingError: gradeJob.error,
    isGrading: gradeJob.isRunning,
    pastSessions,
    startGeneration,
    answerQuestion,
    goToQuestion,
    goToNextAdaptive,
    submitExam,
    cancelGeneration: () => { if (genJobId) cancel(genJobId) },
    resetToSetup,
    reviewSession,
    adaptiveState,
    flaggedQuestions,
    toggleFlag,
    // Resume support
    inProgressSession,
    resumeSession,
    abandonSession,
    updateSectionProgress,
    // Document exam (Type B)
    saveDocumentAnswer,
    submitDocumentExam,
  }
}
