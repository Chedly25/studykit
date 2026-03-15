import { Calendar, Check, Loader2, RefreshCw, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useStudyPlan } from '../hooks/useStudyPlan'

interface StudyActivity {
  topicName: string
  activityType: string
  durationMinutes: number
  completed: boolean
}

const ACTIVITY_ROUTES: Record<string, string> = {
  practice: '/practice-exam',
  socratic: '/socratic',
  'explain-back': '/explain-back',
  flashcards: '/flashcard-maker',
  review: '/chat',
  read: '/sources',
}

const ACTIVITY_LABELS: Record<string, string> = {
  read: 'Read',
  flashcards: 'Flashcards',
  practice: 'Practice',
  socratic: 'Socratic',
  'explain-back': 'Explain Back',
  review: 'Review',
}

export default function StudyPlan() {
  const { t, i18n } = useTranslation()
  const { activeProfile } = useExamProfile()
  const { getToken } = useAuth()
  const profileId = activeProfile?.id
  const {
    activePlan, planDays, todaysPlan, isGenerating,
    generatePlan, markActivityCompleted, deactivatePlan,
  } = useStudyPlan(profileId)

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Calendar className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('ai.studyPlan')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.createProfileFirst')}</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">Create Profile</a>
      </div>
    )
  }

  const handleGenerate = async () => {
    const token = await getToken()
    if (token) await generatePlan(token)
  }

  // No plan — generation view
  if (!activePlan) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
        <div className="text-center mb-8">
          <Calendar className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2">{t('ai.studyPlan')}</h1>
          <p className="text-[var(--text-muted)]">
            {t('ai.studyPlanSubtitle')}
          </p>
        </div>

        <div className="glass-card p-6 text-center">
          <p className="text-sm text-[var(--text-body)] mb-4">
            {t('ai.generatePrompt')}
          </p>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="btn-primary px-8 py-2.5 flex items-center gap-2 mx-auto disabled:opacity-50"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t('ai.generating')}</>
            ) : (
              <><Play className="w-4 h-4" /> {t('ai.generatePlan')}</>
            )}
          </button>
        </div>
      </div>
    )
  }

  // Active plan view
  const today = new Date().toISOString().slice(0, 10)
  const todayActivities: StudyActivity[] = todaysPlan ? JSON.parse(todaysPlan.activities) : []

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-heading)] flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[var(--accent-text)]" /> {t('ai.studyPlan')}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t('ai.planDays', { count: activePlan.totalDays })} &middot; {new Date(activePlan.generatedAt).toLocaleDateString(i18n.language)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="btn-secondary px-3 py-1.5 text-sm flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {t('ai.regeneratePlan')}
          </button>
          <button onClick={deactivatePlan} className="text-sm text-[var(--text-muted)] hover:text-red-500 px-2">
            Dismiss
          </button>
        </div>
      </div>

      {/* Today's activities */}
      {todaysPlan && (
        <div className="glass-card p-4 mb-4 border-l-4 border-[var(--accent-text)]">
          <h2 className="font-semibold text-[var(--text-heading)] mb-3">Today</h2>
          <div className="space-y-2">
            {todayActivities.map((act, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  act.completed ? 'opacity-60' : 'hover:bg-[var(--bg-input)]'
                }`}
              >
                <button
                  onClick={() => markActivityCompleted(todaysPlan.id, i)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    act.completed
                      ? 'bg-[var(--accent-text)] border-[var(--accent-text)]'
                      : 'border-[var(--border-card)]'
                  }`}
                >
                  {act.completed && <Check className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1">
                  <span className={`text-sm ${act.completed ? 'line-through text-[var(--text-faint)]' : 'text-[var(--text-body)]'}`}>
                    {act.topicName}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] ml-2">
                    {ACTIVITY_LABELS[act.activityType] ?? act.activityType} &middot; {act.durationMinutes}m
                  </span>
                </div>
                <Link
                  to={ACTIVITY_ROUTES[act.activityType] ?? '/chat'}
                  className="text-xs text-[var(--accent-text)] hover:underline"
                >
                  Start
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming days */}
      <div className="space-y-3">
        {planDays
          .filter(d => d.date > today)
          .slice(0, 6)
          .map(day => {
            const activities: StudyActivity[] = JSON.parse(day.activities)
            const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString(i18n.language, {
              weekday: 'short', month: 'short', day: 'numeric',
            })
            return (
              <div key={day.id} className="glass-card p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[var(--text-heading)]">{dayLabel}</span>
                  {day.isCompleted && (
                    <span className="text-xs text-green-500 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {t('ai.completed')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activities.map((act, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent-text)]">
                      {act.topicName} — {ACTIVITY_LABELS[act.activityType] ?? act.activityType} ({act.durationMinutes}m)
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
