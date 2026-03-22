import { useState, useEffect } from 'react'
import { Calendar, Check, Loader2, RefreshCw, Play, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useSubscription } from '../hooks/useSubscription'
import { useStudyPlan } from '../hooks/useStudyPlan'
import { useLiveQuery } from 'dexie-react-hooks'
import { Target } from 'lucide-react'
import { db } from '../db'
import { generateICS, downloadICS } from '../lib/calendarExport'
import { RoadmapTimeline } from '../components/plan/RoadmapTimeline'

interface StudyActivity {
  topicName: string
  activityType: string
  durationMinutes: number
  completed: boolean
}

const ACTIVITY_ROUTES: Record<string, string | null> = {
  practice: '/practice-exam',
  socratic: null,
  'explain-back': null,
  flashcards: '/flashcard-maker',
  review: null,
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
  const { isPro } = useSubscription()
  const profileId = activeProfile?.id
  const {
    activePlan, planDays, todaysPlan, isGenerating,
    generatePlan, markActivityCompleted, deactivatePlan,
    replanPlan, replanSuggestion,
  } = useStudyPlan(profileId)

  // Strategist agent insight
  const strategistInsight = useLiveQuery(async () => {
    if (!profileId) return null
    const insight = await db.agentInsights.get(`strategist:${profileId}`)
    if (!insight) return null
    try {
      const data = JSON.parse(insight.data) as { suggestion?: string | null; planOnTrack?: boolean }
      return data.suggestion ?? null
    } catch { return null }
  }, [profileId]) ?? null

  const [confirmDismiss, setConfirmDismiss] = useState(false)
  useEffect(() => {
    if (confirmDismiss) {
      const timer = setTimeout(() => setConfirmDismiss(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [confirmDismiss])

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Calendar className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('ai.studyPlan')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.createProfileFirst')}</p>
        <Link to="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">Create Profile</Link>
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
            {isPro ? t('ai.generatePrompt') : 'AI study plans are a Pro feature. Upgrade to generate a personalized study schedule.'}
          </p>
          {isPro ? (
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
          ) : (
            <Link to="/pricing" className="btn-primary px-8 py-2.5 inline-block">Upgrade to Pro</Link>
          )}
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
            onClick={() => {
              const ics = generateICS(planDays, activeProfile.name)
              downloadICS(ics, 'study-plan.ics')
            }}
            className="btn-secondary px-3 py-1.5 text-sm flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export to Calendar
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="btn-secondary px-3 py-1.5 text-sm flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {t('ai.regeneratePlan')}
          </button>
          <button
            onClick={() => {
              if (confirmDismiss) {
                deactivatePlan()
                setConfirmDismiss(false)
              } else {
                setConfirmDismiss(true)
              }
            }}
            className={`text-sm px-2 ${confirmDismiss ? 'text-red-500 font-medium' : 'text-[var(--text-muted)] hover:text-red-500'}`}
          >
            {confirmDismiss ? 'Are you sure?' : 'Dismiss'}
          </button>
        </div>
      </div>

      {/* Replan suggestion banner */}
      {replanSuggestion && (
        <div className="glass-card p-4 mb-4 border-l-4 border-amber-500 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text-heading)]">{t('studyPlan.replanSuggested')}</p>
            <p className="text-xs text-[var(--text-muted)]">{replanSuggestion}</p>
          </div>
          <button
            onClick={async () => {
              const token = await getToken()
              if (token) replanPlan(token, replanSuggestion)
            }}
            disabled={isGenerating}
            className="btn-primary text-sm px-4 py-1.5 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {t('studyPlan.replan')}
          </button>
        </div>
      )}

      {/* Macro Roadmap Timeline */}
      {profileId && <RoadmapTimeline examProfileId={profileId} />}

      {/* Strategist agent suggestion */}
      {strategistInsight && !replanSuggestion && (
        <div className="glass-card p-4 mb-4 border-l-4 border-blue-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">Strategy suggestion</p>
              <p className="text-xs text-[var(--text-muted)]">{strategistInsight}</p>
            </div>
          </div>
        </div>
      )}

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
                {ACTIVITY_ROUTES[act.activityType] ? (
                  <Link
                    to={ACTIVITY_ROUTES[act.activityType]!}
                    className="text-xs text-[var(--accent-text)] hover:underline"
                  >
                    Start
                  </Link>
                ) : (
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open-chat-panel'))}
                    className="text-xs text-[var(--accent-text)] hover:underline"
                  >
                    Start
                  </button>
                )}
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
