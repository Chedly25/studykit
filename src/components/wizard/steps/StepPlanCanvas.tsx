import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Loader2, ChevronLeft, Sparkles, Rocket } from 'lucide-react'
import { PlanWeekGrid } from '../PlanWeekGrid'
import { PlanChatLane } from '../PlanChatLane'
import { useExamProfile } from '../../../hooks/useExamProfile'
import { usePlanCanvasAgent } from '../../../hooks/usePlanCanvasAgent'
import { generateStudyPlanDraftStreaming, saveStudyPlan } from '../../../ai/studyPlanGenerator'
import type { WizardDraft, WizardAction, PlanDraftData, PlanDraftDay, PlanDraftActivity } from '../../../hooks/useWizardDraft'
import type { ExtractedSubject } from '../../../ai/topicExtractor'

interface StepPlanCanvasProps {
  draft: WizardDraft
  dispatch: React.Dispatch<WizardAction>
  onBack: () => void
}

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function getNextMonday(): Date {
  const now = new Date()
  const day = now.getDay()
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + daysUntilMonday)
  return monday
}

function buildEmptyWeek(monday: Date): PlanDraftData {
  const days: PlanDraftDay[] = DAY_LABELS.map((label, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return {
      date: d.toISOString().slice(0, 10),
      dayLabel: label,
      activities: [],
    }
  })
  return { weekStart: monday.toISOString().slice(0, 10), days }
}

export function StepPlanCanvas({ draft, dispatch, onBack }: StepPlanCanvasProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { seedTopicsForProfile, setActiveProfile } = useExamProfile()
  const agent = usePlanCanvasAgent(draft, dispatch)

  const [isActivating, setIsActivating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [streamingDayCount, setStreamingDayCount] = useState(0)
  const hasGenerated = useRef(false)

  // -1 = generation pending (before first day), 0 = not started, 1–7 = days received
  const isStreaming = streamingDayCount !== 0 && streamingDayCount < 7

  // Snapshot values at mount via ref — avoids unstable deps in useEffect
  const profileIdRef = useRef(draft.profileId)
  const topicNamesRef = useRef(draft.subjects.flatMap(s => s.topics.map(t => t.name)))

  // Generate initial plan on mount — progressive day fill
  useEffect(() => {
    const profileId = profileIdRef.current
    if (hasGenerated.current || draft.planDraft || !profileId) return
    hasGenerated.current = true

    const monday = getNextMonday()
    const weekStart = monday.toISOString().slice(0, 10)

    // Set empty shell immediately so grid is visible from the start
    const emptyWeek = buildEmptyWeek(monday)
    dispatch({ type: 'SET_PLAN_DRAFT', plan: emptyWeek })
    setStreamingDayCount(-1) // pending — show indicator immediately

    const generateInitial = async () => {
      setGenerateError('')

      try {
        const token = await getToken()
        if (!token) throw new Error('Not authenticated')

        await generateStudyPlanDraftStreaming(
          profileId,
          token,
          7,
          { topicNames: topicNamesRef.current, weekStart },
          (day, index) => {
            // Convert to PlanDraftActivity format with IDs
            const activities: PlanDraftActivity[] = day.activities.map(a => ({
              id: crypto.randomUUID(),
              topicName: a.topicName,
              activityType: a.activityType,
              durationMinutes: a.durationMinutes,
            }))
            dispatch({ type: 'SET_PLAN_DAY_ACTIVITIES', dayIndex: index, activities })
            setStreamingDayCount(index + 1)
          },
        )
        setStreamingDayCount(7)
      } catch (err) {
        console.error('Failed to generate plan:', err)
        setGenerateError(err instanceof Error ? err.message : 'Failed to generate plan')
        setStreamingDayCount(7) // Clear streaming indicator
      }
    }

    generateInitial()
  }, [draft.planDraft, getToken, dispatch])

  // "Start learning" — activate everything
  const handleActivate = useCallback(async () => {
    const { profileId, planDraft, subjects, assessments } = draft
    if (!profileId || !planDraft) return

    setIsActivating(true)
    try {
      // 1. Seed topics with assessments
      const extractedSubjects: ExtractedSubject[] = subjects.map(s => ({
        name: s.name,
        weight: s.weight,
        topics: s.topics.map(t => ({ name: t.name })),
      }))
      await seedTopicsForProfile(profileId, extractedSubjects, assessments)

      // 2. Save the study plan
      const token = await getToken()
      if (token) {
        const parsedPlan = {
          days: planDraft.days.map(d => ({
            date: d.date,
            activities: d.activities.map(a => ({
              topicName: a.topicName,
              activityType: a.activityType,
              durationMinutes: a.durationMinutes,
            })),
          })),
        }
        await saveStudyPlan(profileId, parsedPlan)
      }

      // 3. Ensure profile is active
      await setActiveProfile(profileId)

      // 4. Navigate to dashboard
      navigate('/dashboard')
    } catch (err) {
      console.error('Failed to activate:', err)
    } finally {
      setIsActivating(false)
    }
  }, [draft.profileId, draft.planDraft, draft.subjects, draft.assessments, seedTopicsForProfile, getToken, setActiveProfile, navigate])

  if (!draft.planDraft) return null

  const totalActivities = draft.planDraft.days.reduce((sum, d) => sum + d.activities.length, 0)
  const totalMinutes = draft.planDraft.days.reduce(
    (sum, d) => sum + d.activities.reduce((s, a) => s + a.durationMinutes, 0), 0
  )

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)]">
            {t('wizard.planTitle', 'Your study plan')}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {generateError
              ? t('wizard.planEmptyHint', 'Add activities manually or use the chat to build your plan')
              : t('wizard.planSubtitle', 'Here\'s a starting point based on what you told us. Edit directly or use the chat below.')
            }
          </p>
        </div>
        <div className="text-right text-xs text-[var(--text-muted)]">
          <div>{totalActivities} {totalActivities === 1 ? 'activity' : 'activities'}</div>
          <div>{Math.round(totalMinutes / 60 * 10) / 10}h total</div>
        </div>
      </div>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[var(--accent-bg)] text-sm text-[var(--accent-text)]">
          <Sparkles className="w-4 h-4 animate-pulse" />
          {streamingDayCount > 0
            ? `Building day ${streamingDayCount} of 7...`
            : 'Preparing your study plan...'
          }
        </div>
      )}

      {/* Week Grid */}
      <PlanWeekGrid plan={draft.planDraft} subjects={draft.subjects} dispatch={dispatch} />

      {/* AI Chat Lane */}
      <PlanChatLane
        messages={agent.chatMessages}
        isLoading={agent.isLoading}
        streamingText={agent.streamingText}
        currentToolCall={agent.currentToolCall}
        suggestions={agent.suggestions}
        onSend={agent.sendMessage}
        onDismissSuggestion={agent.dismissSuggestion}
      />

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button onClick={onBack} className="btn-secondary px-4 py-2 flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> {t('common.back')}
        </button>
        <button
          onClick={handleActivate}
          disabled={isActivating || isStreaming || totalActivities === 0}
          className="btn-primary px-8 py-3 text-base font-semibold flex items-center gap-2 disabled:opacity-40"
        >
          {isActivating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('wizard.activating', 'Setting up...')}
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5" />
              {t('wizard.startLearning', 'Start learning')}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
