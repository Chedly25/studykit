/**
 * Dashboard — command center style.
 * Delegates to NewUserDashboard or ActiveDashboard based on user state.
 */
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useDailyQueue } from '../hooks/useDailyQueue'
import { NewUserDashboard } from '../components/dashboard/NewUserDashboard'
import { ActiveDashboard } from '../components/dashboard/ActiveDashboard'

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useUser()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, streak } = useKnowledgeGraph(profileId)
  const { queue: dailyQueue } = useDailyQueue(profileId)

  // Counts for new user detection
  const documentCount = useLiveQuery(
    () => profileId ? db.documents.where('examProfileId').equals(profileId).count() : 0,
    [profileId],
  ) ?? 0

  const practiceExamCount = useLiveQuery(
    () => profileId ? db.practiceExamSessions.where('examProfileId').equals(profileId).count() : 0,
    [profileId],
  ) ?? 0

  const sessionCount = useLiveQuery(
    () => profileId ? db.studySessions.where('examProfileId').equals(profileId).count() : 0,
    [profileId],
  ) ?? 0

  const daysUntilExam = activeProfile?.examDate
    ? Math.max(0, Math.ceil((new Date(activeProfile.examDate).getTime() - Date.now()) / 86400000))
    : undefined

  const avgMastery = useMemo(() =>
    topics.length > 0 ? topics.reduce((s, t) => s + t.mastery, 0) / topics.length : 0,
    [topics],
  )

  const queueInProgress = useMemo(() => {
    if (!profileId) return false
    const today = new Date().toISOString().slice(0, 10)
    try {
      const saved = localStorage.getItem(`queue_progress_${profileId}_${today}`)
      if (!saved) return false
      const progress = JSON.parse(saved)
      return progress.completedIds?.length > 0
    } catch { return false }
  }, [profileId])

  // No profile → create one
  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('dashboard.welcome')}</h1>
        <p className="text-[var(--text-muted)] mb-6">{t('dashboard.setupPrompt')}</p>
        <Link to="/exam-profile" className="btn-primary px-6 py-2.5 inline-block">{t('dashboard.createProfile')}</Link>
      </div>
    )
  }

  // New user → guided onboarding cards
  const isNewUser = avgMastery < 0.1 && documentCount === 0 && practiceExamCount === 0
  if (isNewUser) {
    return (
      <NewUserDashboard
        profile={activeProfile}
        userName={user?.firstName ?? undefined}
        documentCount={documentCount}
        practiceExamCount={practiceExamCount}
        sessionCount={sessionCount}
      />
    )
  }

  // Active user → command center
  return (
    <ActiveDashboard
      profile={activeProfile}
      userName={user?.firstName ?? undefined}
      topics={topics}
      subjects={subjects}
      dailyQueue={dailyQueue}
      streak={streak}
      avgMastery={avgMastery}
      daysUntilExam={daysUntilExam}
      queueInProgress={queueInProgress}
    />
  )
}
