import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useSources } from '../hooks/useSources'
import { usePracticeExam } from '../hooks/usePracticeExam'
import { PracticeExamSetup } from '../components/practice/PracticeExamSetup'
import { PracticeExamGenerator } from '../components/practice/PracticeExamGenerator'
import { PracticeExamTaker } from '../components/practice/PracticeExamTaker'
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
  const masterySnapshotRef = useRef<Map<string, number>>(new Map())
  const streakRef = useRef(streak)
  streakRef.current = streak
  const weeklyHoursRef = useRef(weeklyHours)
  weeklyHoursRef.current = weeklyHours
  const [completionData, setCompletionData] = useState<SessionCompletionData | null>(null)

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
      }
      buildCompletion()
    }
  }, [exam.phase, exam.session, completionData, activeProfile?.weeklyTargetHours])

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('ai.practiceSession')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.createProfileFirst')}</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">{t('profile.create')}</a>
      </div>
    )
  }

  if (exam.phase === 'setup') {
    return (
      <>
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
    return (
      <PracticeExamTaker
        questions={exam.questions}
        currentIndex={exam.currentQuestionIndex}
        answers={exam.answers}
        timeRemaining={exam.timeRemaining}
        targetDifficulty={exam.adaptiveState.targetDifficulty}
        onAnswer={exam.answerQuestion}
        onNavigate={exam.goToQuestion}
        onSubmit={exam.submitExam}
        onNextAdaptive={exam.goToNextAdaptive}
      />
    )
  }

  // grading or results
  return (
    <>
      {completionData && (
        <SessionCompletionOverlay
          data={completionData}
          onDismiss={() => setCompletionData(null)}
        />
      )}
      <PracticeExamResults
        session={exam.session}
        questions={exam.questions}
        isGrading={exam.isGrading}
        gradingProgress={exam.gradingProgress}
        onRetake={exam.resetToSetup}
      />
    </>
  )
}
