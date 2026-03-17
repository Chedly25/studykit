import { useState, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Subject, Topic, DailyStudyLog, StudyPlanDay } from '../db/schema'
import { computeReadiness, computeStreak, decayedMastery } from '../lib/knowledgeGraph'
import { generateStudyPlanDraft, saveStudyPlan } from '../ai/studyPlanGenerator'
import type { ParsedPlanData } from '../ai/studyPlanGenerator'

export type CanvasMode = 'builder' | 'generating' | 'result' | 'completed'

const ALL_ACTIVITY_TYPES = ['read', 'flashcards', 'practice', 'socratic', 'explain-back', 'review']

function getCurrentOrNextMonday(): string {
  const d = new Date()
  const day = d.getDay()
  // If today is Monday, use today; otherwise advance to next Monday
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function useStudyPlanCanvas(examProfileId: string | undefined) {
  const [mode, setMode] = useState<CanvasMode>('builder')
  const [weekStart, setWeekStart] = useState(getCurrentOrNextMonday)
  const [dailyHours, setDailyHours] = useState<number | null>(null)
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string> | null>(null)
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<Set<string>>(new Set(ALL_ACTIVITY_TYPES))
  const [draftData, setDraftData] = useState<ParsedPlanData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Live data from IndexedDB
  const profile = useLiveQuery(
    () => examProfileId ? db.examProfiles.get(examProfileId) : undefined,
    [examProfileId],
  )

  const subjects = useLiveQuery(
    () => examProfileId
      ? db.subjects.where('examProfileId').equals(examProfileId).sortBy('order')
      : Promise.resolve([] as Subject[]),
    [examProfileId],
  ) ?? []

  const topics = useLiveQuery(
    () => examProfileId
      ? db.topics.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as Topic[]),
    [examProfileId],
  ) ?? []

  const dailyLogs = useLiveQuery(
    () => examProfileId
      ? db.dailyStudyLogs.where('examProfileId').equals(examProfileId).toArray()
      : Promise.resolve([] as DailyStudyLog[]),
    [examProfileId],
  ) ?? []

  // Check for existing active plan on mount
  const activePlan = useLiveQuery(
    () => examProfileId
      ? db.studyPlans
          .where('examProfileId').equals(examProfileId)
          .filter(p => p.isActive)
          .first()
      : undefined,
    [examProfileId],
  )

  const activePlanDays = useLiveQuery(
    () => activePlan
      ? db.studyPlanDays.where('planId').equals(activePlan.id).sortBy('date')
      : Promise.resolve([] as StudyPlanDay[]),
    [activePlan?.id],
  ) ?? []

  // Computed context values
  const context = useMemo(() => {
    if (!profile) return null
    const daysLeft = profile.examDate
      ? Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000))
      : null
    const readiness = computeReadiness({ subjects, passingThreshold: profile.passingThreshold })
    const streak = computeStreak(dailyLogs)
    return { examName: profile.name, daysLeft, readiness, streak, weeklyTargetHours: profile.weeklyTargetHours }
  }, [profile, subjects, dailyLogs])

  // Topics with decayed mastery, grouped by subject
  const topicsBySubject = useMemo(() => {
    const withDecay = topics.map(t => ({
      ...t,
      decayed: decayedMastery(t),
    }))
    const groups: Array<{ subject: Subject; topics: typeof withDecay }> = []
    for (const s of subjects) {
      const subTopics = withDecay
        .filter(t => t.subjectId === s.id)
        .sort((a, b) => a.decayed - b.decayed)
      if (subTopics.length > 0) {
        groups.push({ subject: s, topics: subTopics })
      }
    }
    return groups
  }, [topics, subjects])

  // Initialize defaults once data loads
  const effectiveDailyHours = dailyHours ?? (profile ? profile.weeklyTargetHours / 7 : 2)

  const effectiveSelectedTopicIds = useMemo(() => {
    if (selectedTopicIds !== null) return selectedTopicIds
    // Pre-select topics with mastery < 0.6
    const ids = new Set<string>()
    for (const t of topics) {
      if (decayedMastery(t) < 0.6) ids.add(t.id)
    }
    return ids
  }, [selectedTopicIds, topics])

  // Determine effective mode: if there's an active plan and user hasn't started building, show completed
  const effectiveMode = useMemo(() => {
    if (mode === 'builder' && activePlan && draftData === null && selectedTopicIds === null) {
      return 'completed' as CanvasMode
    }
    return mode
  }, [mode, activePlan, draftData, selectedTopicIds])

  const toggleTopic = useCallback((topicId: string) => {
    setSelectedTopicIds(prev => {
      const current = prev ?? effectiveSelectedTopicIds
      const next = new Set(current)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
  }, [effectiveSelectedTopicIds])

  const toggleActivityType = useCallback((type: string) => {
    setSelectedActivityTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        if (next.size > 1) next.delete(type) // keep at least one
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  const generate = useCallback(async (authToken: string) => {
    if (!examProfileId) return
    setMode('generating')
    setError(null)
    try {
      // Resolve selected topic names
      const topicNames = topics
        .filter(t => effectiveSelectedTopicIds.has(t.id))
        .map(t => t.name)

      const parsed = await generateStudyPlanDraft(
        examProfileId,
        authToken,
        7,
        {
          topicNames,
          activityTypes: Array.from(selectedActivityTypes),
          dailyMinutes: Math.round(effectiveDailyHours * 60),
          weekStart,
        },
      )
      setDraftData(parsed)
      setMode('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan')
      setMode('builder')
    }
  }, [examProfileId, topics, effectiveSelectedTopicIds, selectedActivityTypes, effectiveDailyHours, weekStart])

  const save = useCallback(async () => {
    if (!examProfileId || !draftData) return
    try {
      await saveStudyPlan(examProfileId, draftData)
      setMode('completed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan')
    }
  }, [examProfileId, draftData])

  const backToBuilder = useCallback(() => {
    setMode('builder')
    // Set non-null to break the auto-completed guard in effectiveMode
    setSelectedTopicIds(prev => prev ?? new Set())
    setDraftData(null)
  }, [])

  return {
    mode: effectiveMode,
    weekStart,
    setWeekStart,
    dailyHours: effectiveDailyHours,
    setDailyHours,
    selectedTopicIds: effectiveSelectedTopicIds,
    selectedActivityTypes,
    toggleTopic,
    toggleActivityType,
    draftData,
    error,
    context,
    topicsBySubject,
    activePlan,
    activePlanDays,
    generate,
    save,
    backToBuilder,
  }
}
