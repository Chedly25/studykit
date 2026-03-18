import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, AlertCircle, BookOpen, Brain, ClipboardCheck, RotateCcw, MessageCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '@clerk/clerk-react'
import { useStudyPlan } from '../../../hooks/useStudyPlan'
import { generateStudyPlanDraftStreaming, saveStudyPlan } from '../../../ai/studyPlanGenerator'

interface OnboardingPlanProps {
  examProfileId: string
  onComplete: () => void
}

type PlanState = 'generating' | 'preview' | 'error'

const ACTIVITY_ICONS: Record<string, typeof BookOpen> = {
  read: BookOpen,
  flashcards: RotateCcw,
  practice: ClipboardCheck,
  socratic: MessageCircle,
  'explain-back': Brain,
  review: RefreshCw,
}

export function OnboardingPlan({ examProfileId, onComplete }: OnboardingPlanProps) {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const { planDays } = useStudyPlan(examProfileId)
  const [state, setState] = useState<PlanState>('generating')
  const [error, setError] = useState('')
  const [dayCount, setDayCount] = useState(0)

  const doGenerate = useCallback(async () => {
    setState('generating')
    setDayCount(0)
    setError('')
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const parsed = await generateStudyPlanDraftStreaming(
        examProfileId,
        token,
        7,
        undefined,
        (_day, index) => { setDayCount(index + 1) },
      )
      await saveStudyPlan(examProfileId, parsed)
      setState('preview')
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Plan generation failed')
    }
  }, [getToken, examProfileId])

  useEffect(() => {
    doGenerate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (state === 'generating') {
    return (
      <div className="glass-card p-8 text-center">
        <Loader2 className="w-10 h-10 text-[var(--accent-text)] mx-auto mb-4 animate-spin" />
        <h3 className="text-lg font-semibold text-[var(--text-heading)]">
          {dayCount > 0
            ? `Building day ${dayCount} of 7...`
            : t('dashboard.onboarding.planGenerating')
          }
        </h3>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="glass-card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
          {t('dashboard.onboarding.planError')}
        </h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">{error}</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={doGenerate} className="btn-primary px-6 py-2">
            {t('dashboard.onboarding.retry')}
          </button>
          <button onClick={onComplete} className="btn-secondary px-6 py-2">
            {t('common.skip', 'Skip')}
          </button>
        </div>
      </div>
    )
  }

  // Show preview of first 3 days
  const previewDays = planDays.slice(0, 3)

  return (
    <div className="glass-card p-6">
      <h2 className="text-xl font-bold text-[var(--text-heading)] mb-4">
        {t('dashboard.onboarding.planTitle')}
      </h2>

      <div className="space-y-4 mb-6">
        {previewDays.map((day) => {
          let activities: Array<{
            topicName: string
            activityType: string
            durationMinutes: number
          }> = []
          try { activities = JSON.parse(day.activities) } catch { /* skip malformed */ }
          const isToday = day.date === new Date().toISOString().slice(0, 10)

          return (
            <div key={day.id} className="border border-[var(--border-card)] rounded-xl p-4">
              <h4 className="text-sm font-semibold text-[var(--text-heading)] mb-3">
                {isToday ? 'Today' : new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </h4>
              <div className="space-y-2">
                {activities.map((activity, i) => {
                  const Icon = ACTIVITY_ICONS[activity.activityType] ?? BookOpen
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <Icon className="w-4 h-4 text-[var(--accent-text)] flex-shrink-0" />
                      <span className="flex-1 text-[var(--text-body)]">{activity.topicName}</span>
                      <span className="text-[var(--text-muted)]">{activity.durationMinutes}m</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onComplete}
          className="btn-primary flex-1 py-3 font-semibold"
        >
          {t('dashboard.onboarding.planApprove')}
        </button>
        <button
          onClick={doGenerate}
          className="px-4 py-3 rounded-xl border border-[var(--border-card)] text-[var(--text-body)] hover:bg-[var(--accent-bg)] transition-colors"
        >
          {t('dashboard.onboarding.planRegenerate')}
        </button>
      </div>
    </div>
  )
}
