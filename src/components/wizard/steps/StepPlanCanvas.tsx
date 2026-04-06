import { useState, useEffect, useCallback, useRef } from 'react'
import * as Sentry from '@sentry/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Loader2, ChevronLeft, Sparkles, Rocket, CalendarDays, List } from 'lucide-react'
import { PlanWeekGrid } from '../PlanWeekGrid'
import { PlanDayView } from '../PlanDayView'
import { PlanChatLane } from '../PlanChatLane'
import { ActivityDetailDialog } from '../ActivityDetailDialog'
import { useExamProfile } from '../../../hooks/useExamProfile'
import { usePlanCanvasAgent } from '../../../hooks/usePlanCanvasAgent'
import { generateStudyPlanDraftStreaming, saveStudyPlan } from '../../../ai/studyPlanGenerator'
import { clearWizardDraft } from '../../../hooks/useWizardDraft'
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

  // View toggle + dialog state
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week')
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [dialogTarget, setDialogTarget] = useState<{ dayIndex: number; activityId: string } | null>(null)

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
        Sentry.captureException(err instanceof Error ? err : new Error('Failed to generate plan: ' + String(err)))
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

      // 4. Clear wizard session and navigate to dashboard
      clearWizardDraft()
      navigate('/dashboard')
    } catch (err) {
      Sentry.captureException(err instanceof Error ? err : new Error('Failed to activate: ' + String(err)))
    } finally {
      setIsActivating(false)
    }
  }, [draft.profileId, draft.planDraft, draft.subjects, draft.assessments, seedTopicsForProfile, getToken, setActiveProfile, navigate])

  // Resolve dialog activity by stable ID (survives reorder/delete of other items)
  let dialogDayIndex: number | null = null
  let dialogActIndex: number | null = null
  let dialogActivity: PlanDraftActivity | null = null
  if (dialogTarget && draft.planDraft) {
    const day = draft.planDraft.days[dialogTarget.dayIndex]
    if (day) {
      const idx = day.activities.findIndex(a => a.id === dialogTarget.activityId)
      if (idx !== -1) {
        dialogDayIndex = dialogTarget.dayIndex
        dialogActIndex = idx
        dialogActivity = day.activities[idx]
      }
    }
  }

  // Auto-close dialog when the activity disappears (e.g. deleted by AI agent)
  useEffect(() => {
    if (dialogTarget && !dialogActivity) setDialogTarget(null)
  }, [dialogTarget, dialogActivity])

  if (!draft.planDraft) return null

  const totalActivities = draft.planDraft.days.reduce((sum, d) => sum + d.activities.length, 0)
  const totalMinutes = draft.planDraft.days.reduce(
    (sum, d) => sum + d.activities.reduce((s, a) => s + a.durationMinutes, 0), 0
  )

  const handleSelectActivity = (dayIndex: number, actIndex: number) => {
    const activity = draft.planDraft?.days[dayIndex]?.activities[actIndex]
    if (activity) setDialogTarget({ dayIndex, activityId: activity.id })
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:gap-6">
        {/* Left panel — plan view */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-heading)]">
                {t('wizard.planTitle')}
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                {generateError
                  ? t('wizard.planEmptyHint')
                  : t('wizard.planSubtitle')
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Stats */}
              <div className="text-right text-xs text-[var(--text-muted)] hidden sm:block">
                <div>{totalActivities} {totalActivities === 1 ? 'activity' : 'activities'}</div>
                <div>{Math.round(totalMinutes / 60 * 10) / 10}h total</div>
              </div>
              {/* View toggle */}
              <div className="flex rounded-lg overflow-hidden border border-[var(--border-card)]">
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    viewMode === 'week'
                      ? 'bg-[var(--accent-text)] text-white'
                      : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Week
                </button>
                <button
                  onClick={() => setViewMode('day')}
                  className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    viewMode === 'day'
                      ? 'bg-[var(--accent-text)] text-white'
                      : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
                  }`}
                >
                  <List className="w-3.5 h-3.5" /> Day
                </button>
              </div>
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

          {/* Plan view */}
          {viewMode === 'week' ? (
            <PlanWeekGrid
              plan={draft.planDraft}
              subjects={draft.subjects}
              dispatch={dispatch}
              onSelectActivity={handleSelectActivity}
            />
          ) : (
            <PlanDayView
              plan={draft.planDraft}
              subjects={draft.subjects}
              selectedDayIndex={selectedDayIndex}
              onSelectDay={setSelectedDayIndex}
              onSelectActivity={handleSelectActivity}
              dispatch={dispatch}
            />
          )}

          {/* Mobile chat — visible below lg */}
          <div className="lg:hidden mt-4">
            <PlanChatLane
              messages={agent.chatMessages}
              isLoading={agent.isLoading}
              streamingText={agent.streamingText}
              currentToolCall={agent.currentToolCall}
              suggestions={agent.suggestions}
              onSend={agent.sendMessage}
              onDismissSuggestion={agent.dismissSuggestion}
            />
          </div>

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
                  {t('wizard.activating')}
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  {t('wizard.startLearning')}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right panel — chat (desktop only) */}
        <div className="hidden lg:block lg:w-[340px] lg:flex-shrink-0 lg:sticky lg:top-4 lg:self-start">
          <PlanChatLane
            messages={agent.chatMessages}
            isLoading={agent.isLoading}
            streamingText={agent.streamingText}
            currentToolCall={agent.currentToolCall}
            suggestions={agent.suggestions}
            onSend={agent.sendMessage}
            onDismissSuggestion={agent.dismissSuggestion}
          />
        </div>
      </div>

      {/* Activity Detail Dialog */}
      {dialogTarget && dialogActivity && dialogDayIndex !== null && dialogActIndex !== null && draft.planDraft && (
        <ActivityDetailDialog
          activity={dialogActivity}
          dayIndex={dialogDayIndex}
          activityIndex={dialogActIndex}
          plan={draft.planDraft}
          subjects={draft.subjects}
          dispatch={dispatch}
          onClose={() => setDialogTarget(null)}
        />
      )}
    </div>
  )
}
