import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { StudySession } from '../db/schema'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useProactiveInsights } from '../hooks/useProactiveInsights'
import { ReadinessGauge } from '../components/dashboard/ReadinessGauge'
import { WeakTopicsCard } from '../components/dashboard/WeakTopicsCard'
import { ExamCountdownCard } from '../components/dashboard/ExamCountdownCard'
import { StudyStreakCard } from '../components/dashboard/StudyStreakCard'
import { TodaysPlanCard } from '../components/dashboard/TodaysPlanCard'
import { ActivityFeed } from '../components/dashboard/ActivityFeed'
import { InsightCard } from '../components/dashboard/InsightCard'
import { TopicTree } from '../components/knowledge/TopicTree'

export default function Dashboard() {
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, readiness, weakTopics, dueTopics, streak, weeklyHours, getTopicsForSubject } = useKnowledgeGraph(profileId)
  const insights = useProactiveInsights(profileId)

  const sessions = useLiveQuery(
    () => profileId
      ? db.studySessions.where('examProfileId').equals(profileId).toArray()
      : Promise.resolve([] as StudySession[]),
    [profileId]
  ) ?? []

  const dueFlashcards = useLiveQuery(
    () => {
      const today = new Date().toISOString().slice(0, 10)
      return db.flashcards.where('nextReviewDate').belowOrEqual(today).count()
    }
  ) ?? 0

  const upcomingAssignments = useLiveQuery(() => {
    const today = new Date().toISOString().slice(0, 10)
    const weekOut = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    return db.assignments
      .where('dueDate')
      .between(today, weekOut, true, true)
      .filter(a => a.status !== 'done')
      .count()
  }) ?? 0

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">Welcome to StudiesKit</h1>
        <p className="text-[var(--text-muted)] mb-6">Set up an exam profile to unlock your personalized dashboard.</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 inline-block">Create Exam Profile</a>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">{activeProfile.name}</h1>
          <p className="text-sm text-[var(--text-muted)]">Your exam preparation command center</p>
        </div>
      </div>

      {/* Insights */}
      <InsightCard insights={insights} />

      {/* Top row: Readiness + Countdown + Streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="glass-card p-4 flex items-center justify-center relative">
          <ReadinessGauge value={readiness} />
        </div>
        <ExamCountdownCard examName={activeProfile.name} examDate={activeProfile.examDate} />
        <StudyStreakCard streak={streak} weeklyHours={weeklyHours} weeklyTarget={activeProfile.weeklyTargetHours} />
      </div>

      {/* Middle row: Today's Plan + Weak Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <TodaysPlanCard dueTopics={dueTopics} dueFlashcardCount={dueFlashcards} upcomingAssignments={upcomingAssignments} />
        <WeakTopicsCard topics={weakTopics} subjects={subjects} />
      </div>

      {/* Bottom row: Activity + Knowledge Graph */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <ActivityFeed sessions={sessions} />
        <div className="glass-card p-4">
          <h3 className="font-semibold text-[var(--text-heading)] mb-3">Knowledge Graph</h3>
          <TopicTree subjects={subjects} getTopicsForSubject={getTopicsForSubject} />
        </div>
      </div>
    </div>
  )
}
