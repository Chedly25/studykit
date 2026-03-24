import { useState, useRef, useEffect, useCallback } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useSources } from '../hooks/useSources'
import { usePracticeExam } from '../hooks/usePracticeExam'
import { useSubscription } from '../hooks/useSubscription'
import { useProctorMode } from '../hooks/useProctorMode'
import { streamChat } from '../ai/client'
import { PracticeExamSetup } from '../components/practice/PracticeExamSetup'
import { PracticeExamGenerator } from '../components/practice/PracticeExamGenerator'
import { PracticeExamTaker } from '../components/practice/PracticeExamTaker'
import { SimulationExamTaker } from '../components/practice/SimulationExamTaker'
import { PracticeExamResults } from '../components/practice/PracticeExamResults'
import { PracticeExamHistory } from '../components/practice/PracticeExamHistory'
import { SessionCompletionOverlay, type SessionCompletionData } from '../components/SessionCompletionOverlay'
import { decayedMastery } from '../lib/knowledgeGraph'
import { db } from '../db'

export default function PracticeExam() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, weakTopics, streak, weeklyHours } = useKnowledgeGraph(profileId)
  const { documentCount } = useSources(profileId)

  const exam = usePracticeExam(profileId)
  const { isPro } = useSubscription()
  const isProctorActive = exam.phase === 'taking' && exam.session?.proctorMode === true
  const [proctorWarning, setProctorWarning] = useState<string | null>(null)

  const handleProctorEvent = useCallback((event: import('../hooks/useProctorMode').ProctorEvent) => {
    const messages: Record<string, string> = {
      'tab-switch': 'Tab switch detected',
      'exit-fullscreen': 'Fullscreen exited',
      'copy': 'Copy attempt detected',
      'paste': 'Paste attempt detected',
      'right-click': 'Right-click blocked',
    }
    setProctorWarning(messages[event.type] ?? 'Proctor event')
    setTimeout(() => setProctorWarning(null), 3000)
  }, [])

  const { getFlags: getProctorFlags } = useProctorMode(isProctorActive, handleProctorEvent)
  const masterySnapshotRef = useRef<Map<string, number>>(new Map())
  const streakRef = useRef(streak)
  streakRef.current = streak
  const weeklyHoursRef = useRef(weeklyHours)
  weeklyHoursRef.current = weeklyHours
  const [completionData, setCompletionData] = useState<SessionCompletionData | null>(null)
  const [aiDebrief, setAiDebrief] = useState('')
  const [isDebriefStreaming, setIsDebriefStreaming] = useState(false)
  const debriefAbortRef = useRef<AbortController | null>(null)
  const { getToken } = useAuth()

  // Scroll to top on phase change
  useEffect(() => { window.scrollTo(0, 0) }, [exam.phase])

  // Snapshot mastery when exam starts
  useEffect(() => {
    if (exam.phase === 'taking' && masterySnapshotRef.current.size === 0) {
      const snapshot = new Map<string, number>()
      for (const t of topics) {
        snapshot.set(t.id, decayedMastery(t))
      }
      masterySnapshotRef.current = snapshot
    }
    if (exam.phase === 'setup') {
      masterySnapshotRef.current = new Map()
      setCompletionData(null)
      setAiDebrief('')
      debriefAbortRef.current?.abort()
    }
  }, [exam.phase, topics])

  // Build completion data when results are available
  useEffect(() => {
    if (exam.phase === 'results' && exam.session && !completionData) {
      const buildCompletion = async () => {
        const session = exam.session!
        const totalScore = session.totalScore ?? 0
        const maxScore = session.maxScore ?? 1
        const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

        // Compute mastery deltas
        const deltas: Array<{ topicName: string; before: number; after: number }> = []
        for (const [tid, beforeVal] of masterySnapshotRef.current) {
          const topic = await db.topics.get(tid)
          if (topic) {
            const afterVal = decayedMastery(topic)
            if (Math.abs(afterVal - beforeVal) > 0.005) {
              deltas.push({ topicName: topic.name, before: beforeVal, after: afterVal })
            }
          }
        }

        const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : Date.now()
        const completedAt = session.completedAt ? new Date(session.completedAt).getTime() : Date.now()

        setCompletionData({
          activityType: 'practice-exam',
          timeSpentSeconds: Math.round((completedAt - startedAt) / 1000),
          streak: streakRef.current,
          weeklyHours: weeklyHoursRef.current,
          weeklyTarget: activeProfile?.weeklyTargetHours ?? 10,
          masteryDeltas: deltas.length > 0 ? deltas : undefined,
          examStats: { score: totalScore, maxScore, percentage, passed: percentage >= 60 },
        })

        // Generate AI debrief for the practice exam
        setIsDebriefStreaming(true)
        const controller = new AbortController()
        debriefAbortRef.current = controller
        try {
          const token = await getToken()
          if (token && !controller.signal.aborted) {
            const deltaSummary = deltas.map(d => `${d.topicName}: ${Math.round(d.before * 100)}% → ${Math.round(d.after * 100)}%`).join('; ')
            const prompt = `Student just completed a practice exam.\n` +
              `Score: ${totalScore}/${maxScore} (${percentage}%). ${percentage >= 60 ? 'Passed.' : 'Did not pass.'}\n` +
              (deltaSummary ? `Mastery changes: ${deltaSummary}.\n` : '') +
              `Give a 3-5 sentence coaching debrief. Acknowledge the score honestly. Highlight which areas improved or need work. End with one concrete recommendation for what to focus on next.`

            let text = ''
            await streamChat({
              messages: [{ role: 'user', content: prompt }],
              system: 'You are a study coach giving a brief post-exam debrief. Be warm, honest, and actionable. Use LaTeX $...$ for math if relevant. Never use emojis.',
              tools: [],
              maxTokens: 1024,
              authToken: token,
              onToken: (tok) => { text += tok; setAiDebrief(text) },
              signal: controller.signal,
            })
          }
        } catch { /* non-critical */ }
        finally { setIsDebriefStreaming(false) }
      }
      buildCompletion()
    }
  }, [exam.phase, exam.session, completionData, activeProfile?.weeklyTargetHours, getToken])

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('ai.practiceSession')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.createProfileFirst')}</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">{t('profile.create')}</a>
      </div>
    )
  }

  if (exam.phase === 'setup' && !isPro) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <ClipboardCheck className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-heading)] mb-2">Practice Exams — Pro</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Generate AI-powered practice exams from your study materials with automatic grading and feedback.
        </p>
        <a href="/pricing" className="btn-primary px-6 py-2.5 inline-block">Upgrade to Pro</a>
      </div>
    )
  }

  if (exam.phase === 'setup') {
    return (
      <>
        {/* Resume prompt for in-progress exams */}
        {exam.inProgressSession && (
          <div className="max-w-3xl mx-auto px-4 pt-6">
            <div className="glass-card p-5 mb-4 border-l-4 border-[var(--accent-text)] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[var(--text-heading)] mb-1">{t('practiceExam.resumeExam', 'Resume Exam')}</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  {t('practiceExam.unfinishedExam', 'You have an unfinished exam from {{time}}.', {
                    time: exam.inProgressSession.startedAt
                      ? new Date(exam.inProgressSession.startedAt).toLocaleString()
                      : 'earlier',
                  })}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 ml-4">
                <button onClick={() => exam.resumeSession(exam.inProgressSession!.id)} className="btn-primary text-sm px-4 py-2">
                  {t('practiceExam.resume', 'Resume')}
                </button>
                <button onClick={() => exam.abandonSession(exam.inProgressSession!.id)} className="btn-secondary text-sm px-4 py-2">
                  {t('practiceExam.startNew', 'Start New')}
                </button>
              </div>
            </div>
          </div>
        )}
        <PracticeExamSetup
          examProfileId={activeProfile.id}
          subjects={subjects}
          topics={topics}
          weakTopics={weakTopics}
          documentCount={documentCount}
          onStart={exam.startGeneration}
        />
        {exam.pastSessions.length > 0 && (
          <div className="max-w-3xl mx-auto px-4">
            <PracticeExamHistory
              sessions={exam.pastSessions}
              onReview={exam.reviewSession}
              onRetake={(session) => {
                exam.startGeneration({
                  questionCount: session.questionCount,
                  focusSubject: session.focusSubject,
                  sourcesEnabled: session.sourcesEnabled,
                  timeLimitSeconds: session.timeLimitSeconds,
                })
              }}
            />
          </div>
        )}
      </>
    )
  }

  if (exam.phase === 'generating') {
    return (
      <PracticeExamGenerator
        progress={exam.generationProgress}
        error={exam.generationError}
        onCancel={() => {
          exam.cancelGeneration()
          exam.resetToSetup()
        }}
      />
    )
  }

  if (exam.phase === 'taking') {
    // Proctor warning toast
    const proctorToast = proctorWarning ? (
      <div className="fixed top-4 right-4 z-50 glass-card p-3 border-l-4 border-red-500 animate-fade-in shadow-lg">
        <span className="text-sm text-red-500 font-medium">{proctorWarning}</span>
      </div>
    ) : null

    // Simulation mode: multi-section taker with per-section timers
    if (exam.session?.simulationMode && exam.session.sectionProgress) {
      const sections = JSON.parse(exam.session.sectionProgress) as Array<{ sectionId: string; formatName: string; sectionType: string; timeAllocationMinutes: number; questionCount: number; prepTimeMinutes?: number; instructions?: string }>
      return (
        <>
        {proctorToast}
        <SimulationExamTaker
          sessionId={exam.session.id}
          examProfileId={profileId!}
          sections={sections.map(s => ({ examFormatId: s.sectionId, ...s }))}
          proctorMode={exam.session.proctorMode ?? false}
          onSubmit={() => exam.submitExam(isProctorActive ? getProctorFlags() : undefined)}
          initialSectionIndex={exam.session.currentSectionIndex ?? 0}
          onSectionChange={exam.updateSectionProgress}
        />
        </>
      )
    }

    // Practice mode: standard taker
    return (
      <>
      {proctorToast}
      <PracticeExamTaker
        questions={exam.questions}
        currentIndex={exam.currentQuestionIndex}
        answers={exam.answers}
        timeRemaining={exam.timeRemaining}
        targetDifficulty={exam.adaptiveState.targetDifficulty}
        flaggedIds={exam.flaggedQuestions}
        onAnswer={exam.answerQuestion}
        onNavigate={exam.goToQuestion}
        onSubmit={() => exam.submitExam(isProctorActive ? getProctorFlags() : undefined)}
        onNextAdaptive={exam.goToNextAdaptive}
        onToggleFlag={exam.toggleFlag}
      />
      </>
    )
  }

  // grading or results
  return (
    <>
      {completionData && (
        <SessionCompletionOverlay
          data={completionData}
          onDismiss={() => { setCompletionData(null); setAiDebrief('') }}
          aiDebrief={aiDebrief}
          isDebriefStreaming={isDebriefStreaming}
        />
      )}
      <PracticeExamResults
        session={exam.session}
        questions={exam.questions}
        isGrading={exam.isGrading}
        gradingProgress={exam.gradingProgress}
        onRetake={exam.resetToSetup}
        examProfileId={profileId}
      />
    </>
  )
}
