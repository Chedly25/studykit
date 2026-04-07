/**
 * Dashboard — command center style.
 * Delegates to NewUserDashboard or ActiveDashboard based on user state.
 * Shows "level up" banner when transitioning from new → active.
 */
import { useMemo, useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { Sparkles } from 'lucide-react'
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

  // Check if user just completed onboarding (may have docs uploaded but mastery still 0)
  const hasPostOnboarding = useMemo(() => {
    try {
      const raw = localStorage.getItem('postOnboarding')
      if (!raw) return false
      const data = JSON.parse(raw)
      return data.profileId === profileId && (Date.now() - data.completedAt < 30 * 60 * 1000)
    } catch { return false }
  }, [profileId])

  // New user → guided onboarding cards
  const isNewUser = (avgMastery < 0.1 && documentCount === 0 && practiceExamCount === 0) || hasPostOnboarding

  // Track "was new user" for level-up transition detection
  useEffect(() => {
    if (isNewUser && profileId) {
      localStorage.setItem(`wasNewUser_${profileId}`, 'true')
    }
  }, [isNewUser, profileId])

  // Level-up banner when transitioning from new → active
  const [showLevelUp, setShowLevelUp] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (!isNewUser && profileId) {
      const wasNew = localStorage.getItem(`wasNewUser_${profileId}`)
      const alreadyShown = localStorage.getItem(`levelUpShown_${profileId}`)
      if (wasNew && !alreadyShown) {
        setShowLevelUp(true)
        localStorage.setItem(`levelUpShown_${profileId}`, 'true')
        import('../lib/confetti').then(({ fireConfetti }) => fireConfetti('subtle')).catch(() => {})
        timer = setTimeout(() => setShowLevelUp(false), 5000)
      }
    }
    return () => clearTimeout(timer)
  }, [isNewUser, profileId])

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
    <>
      {showLevelUp && (
        <div className="max-w-2xl mx-auto px-4 pt-6">
          <div className="glass-card p-4 mb-0 flex items-center gap-3 animate-fade-in-up bg-emerald-500/5 border-emerald-500/20">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-heading)]">{t('dashboard.levelUp.title')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('dashboard.levelUp.subtitle')}</p>
            </div>
          </div>
        </div>
      )}
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
    </>
  )
}
