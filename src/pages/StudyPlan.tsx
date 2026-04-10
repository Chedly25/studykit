import { useState, useEffect, useMemo } from 'react'
import { Calendar, Check, Loader2, RefreshCw, Play, Download, ChevronLeft, ChevronRight, AlertTriangle, ArrowRight } from 'lucide-react'
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

/**
 * Route per activity type. Returns a route that may include `?topic=...&mode=...`.
 * Null means "no route, use fallback" — currently unreachable since every
 * activity type has a destination.
 */
function activityRoute(activityType: string, topicName: string | undefined): string | null {
  const topicPart = topicName ? `topic=${encodeURIComponent(topicName)}` : ''
  const makeSessionRoute = (mode?: string) => {
    const parts = [topicPart, mode ? `mode=${mode}` : ''].filter(Boolean)
    return parts.length > 0 ? `/session?${parts.join('&')}` : '/session'
  }
  switch (activityType) {
    case 'practice':
      return '/practice-exam'
    case 'flashcards':
      return '/flashcard-maker'
    case 'read':
      return '/sources'
    // Structured session modes activate a specialized system prompt
    // (see `buildSocraticPrompt` / `buildExplainBackPrompt` in src/ai/systemPrompt.ts)
    case 'socratic':
      return makeSessionRoute('socratic')
    case 'explain-back':
      return makeSessionRoute('explain-back')
    case 'review':
      return makeSessionRoute()
    default:
      return null
  }
}

const ACTIVITY_LABELS: Record<string, string> = {
  read: 'Read',
  flashcards: 'Flashcards',
  practice: 'Practice',
  socratic: 'Socratic',
  'explain-back': 'Explain Back',
  review: 'Review',
}

function getWeekDates(offset: number): string[] {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
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
    replanPlan, replanSuggestion, missedDayCount,
    rescheduleDay, catchUp,
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
  const [view, setView] = useState<'list' | 'week'>('list')
  const [weekOffset, setWeekOffset] = useState(0)

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
  const planDayMap = new Map(planDays.map(d => [d.date, d]))

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
            Export
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

      {/* Behind schedule banner */}
      {missedDayCount > 0 && !replanSuggestion && (
        <div className="glass-card p-4 mb-4 border-l-4 border-amber-500 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">
                {t('studyPlan.behindSchedule', 'You\'re {{count}} days behind schedule', { count: missedDayCount })}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={catchUp}
              className="btn-primary text-xs px-3 py-1.5"
            >
              {t('studyPlan.catchUp')}
            </button>
            <button
              onClick={async () => {
                const token = await getToken()
                if (token) replanPlan(token, `${missedDayCount} days behind`)
              }}
              disabled={isGenerating}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              {t('studyPlan.replan')}
            </button>
          </div>
        </div>
      )}

      {/* Replan suggestion banner */}
      {replanSuggestion && (
        <div className="glass-card p-4 mb-4 border-l-4 border-amber-500 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text-heading)]">{t('studyPlan.replanSuggested')}</p>
            <p className="text-xs text-[var(--text-muted)]">{replanSuggestion}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={catchUp}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              {t('studyPlan.catchUp')}
            </button>
            <button
              onClick={async () => {
                const token = await getToken()
                if (token) replanPlan(token, replanSuggestion)
              }}
              disabled={isGenerating}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {t('studyPlan.replan')}
            </button>
          </div>
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

      {/* View toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setView('list')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            view === 'list' ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
          }`}
        >
          {t('studyPlan.listView')}
        </button>
        <button
          onClick={() => { setView('week'); setWeekOffset(0) }}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            view === 'week' ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
          }`}
        >
          {t('studyPlan.weekView')}
        </button>
      </div>

      {/* ─── WEEK VIEW ─── */}
      {view === 'week' && (
        <WeeklyCalendar
          weekOffset={weekOffset}
          onPrev={() => setWeekOffset(w => w - 1)}
          onNext={() => setWeekOffset(w => w + 1)}
          planDayMap={planDayMap}
          today={today}
          onReschedule={(fromDate) => rescheduleDay(fromDate, today)}
          onMarkCompleted={markActivityCompleted}
          lang={i18n.language}
        />
      )}

      {/* ─── LIST VIEW ─── */}
      {view === 'list' && (
        <>
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
                    {(() => {
                      const route = activityRoute(act.activityType, act.topicName)
                      return route ? (
                        <Link
                          to={route}
                          className="text-xs text-[var(--accent-text)] hover:underline"
                        >
                          Start
                        </Link>
                      ) : null
                    })()}
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
        </>
      )}
    </div>
  )
}

// ─── Weekly Calendar Component ──────────────────────────────────

function WeeklyCalendar({ weekOffset, onPrev, onNext, planDayMap, today, onReschedule, onMarkCompleted, lang }: {
  weekOffset: number
  onPrev: () => void
  onNext: () => void
  planDayMap: Map<string, import('../db/schema').StudyPlanDay>
  today: string
  onReschedule: (fromDate: string) => void
  onMarkCompleted: (dayId: string, activityIndex: number) => void
  lang: string
}) {
  const { t } = useTranslation()
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const weekLabel = useMemo(() => {
    const start = new Date(weekDates[0] + 'T12:00:00')
    const end = new Date(weekDates[6] + 'T12:00:00')
    return `${start.toLocaleDateString(lang, { month: 'short', day: 'numeric' })} — ${end.toLocaleDateString(lang, { month: 'short', day: 'numeric' })}`
  }, [weekDates, lang])

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)]">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-[var(--text-heading)]">{weekLabel}</span>
        <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)]">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 7-column grid — stack on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
        {weekDates.map(date => {
          const planDay = planDayMap.get(date)
          const isToday = date === today
          const isPast = date < today
          const activities: StudyActivity[] = planDay ? JSON.parse(planDay.activities) : []
          const hasUncompleted = isPast && planDay && !planDay.isCompleted && activities.some(a => !a.completed)

          const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString(lang, { weekday: 'short', day: 'numeric' })

          return (
            <div
              key={date}
              className={`glass-card p-2 min-h-[120px] flex flex-col ${
                isToday ? 'border-2 border-[var(--accent-text)]' :
                hasUncompleted ? 'border-l-4 border-red-400' : ''
              }`}
            >
              {/* Day header */}
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-semibold uppercase ${
                  isToday ? 'text-[var(--accent-text)]' : isPast ? 'text-[var(--text-faint)]' : 'text-[var(--text-muted)]'
                }`}>
                  {dayLabel}
                </span>
                {planDay?.isCompleted && <Check className="w-3 h-3 text-emerald-500" />}
              </div>

              {/* Activities */}
              <div className="flex-1 space-y-1">
                {activities.length === 0 && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--border-card)] mx-auto mt-4" />
                )}
                {activities.map((act, i) => (
                  <div
                    key={i}
                    className={`text-[10px] px-1.5 py-1 rounded ${
                      act.completed
                        ? 'bg-emerald-500/10 text-emerald-600 line-through'
                        : isPast
                          ? 'bg-red-500/10 text-red-600'
                          : 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                    }`}
                  >
                    <span className="font-medium">{act.topicName}</span>
                    <span className="opacity-70"> · {ACTIVITY_LABELS[act.activityType] ?? act.activityType} · {act.durationMinutes}m</span>
                    {isToday && !act.completed && planDay && (
                      <button
                        onClick={() => onMarkCompleted(planDay.id, i)}
                        className="ml-1 text-[var(--accent-text)] hover:underline"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Reschedule button for missed days */}
              {hasUncompleted && (
                <button
                  onClick={() => onReschedule(date)}
                  className="mt-1.5 text-[10px] font-medium text-amber-600 hover:underline flex items-center gap-0.5"
                >
                  <ArrowRight className="w-2.5 h-2.5" /> {t('studyPlan.moveToToday')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
