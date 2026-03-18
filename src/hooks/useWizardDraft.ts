/**
 * Wizard state management via useReducer.
 * Nothing hits the DB until the user clicks "Start learning" at the end of Step 5.
 * A profile is created early (end of Step 1) so document uploads have an examProfileId.
 */
import { useReducer, useCallback } from 'react'
import type { ExamType, ProfileMode } from '../db/schema'

// ─── Types ──────────────────────────────────────────────────────

export interface DraftSubject {
  tempId: string
  name: string
  weight: number
  color: string
  topics: DraftTopic[]
}

export interface DraftTopic {
  tempId: string
  name: string
}

export interface PlanDraftActivity {
  id: string
  topicName: string
  activityType: string
  durationMinutes: number
}

export interface PlanDraftDay {
  date: string
  dayLabel: string
  activities: PlanDraftActivity[]
}

export interface PlanDraftData {
  weekStart: string
  days: PlanDraftDay[]
}

export type WizardStep = 1 | 2 | 3 | 4 | 5

export interface WizardDraft {
  // Step 1
  profileMode: ProfileMode
  examType: ExamType | null
  name: string
  examDate: string
  noDeadline: boolean
  weeklyTargetHours: number
  profileId: string | null

  // Step 2
  landscapeSource: 'upload' | 'paste' | 'freetext' | 'manual' | null
  subjects: DraftSubject[]
  researchQuestion: string
  researchStage: string | null

  // Step 3
  assessments: Record<string, 'new' | 'some' | 'confident'>

  // Step 4
  uploadedDocumentIds: string[]
  processingJobIds: string[]

  // Step 5
  planDraft: PlanDraftData | null

  // Nav
  currentStep: WizardStep
}

// ─── Actions ────────────────────────────────────────────────────

export type WizardAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_PROFILE_MODE'; mode: ProfileMode }
  | { type: 'SET_EXAM_TYPE'; examType: ExamType }
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_EXAM_DATE'; date: string }
  | { type: 'SET_NO_DEADLINE'; noDeadline: boolean }
  | { type: 'SET_WEEKLY_HOURS'; hours: number }
  | { type: 'SET_PROFILE_ID'; profileId: string }
  | { type: 'SET_LANDSCAPE_SOURCE'; source: WizardDraft['landscapeSource'] }
  | { type: 'SET_SUBJECTS'; subjects: DraftSubject[] }
  | { type: 'ADD_SUBJECT'; subject: DraftSubject }
  | { type: 'UPDATE_SUBJECT'; tempId: string; updates: Partial<Omit<DraftSubject, 'tempId'>> }
  | { type: 'REMOVE_SUBJECT'; tempId: string }
  | { type: 'ADD_TOPIC'; subjectTempId: string; topic: DraftTopic }
  | { type: 'UPDATE_TOPIC'; subjectTempId: string; topicTempId: string; name: string }
  | { type: 'REMOVE_TOPIC'; subjectTempId: string; topicTempId: string }
  | { type: 'SET_RESEARCH_QUESTION'; question: string }
  | { type: 'SET_RESEARCH_STAGE'; stage: string | null }
  | { type: 'SET_ASSESSMENT'; key: string; level: 'new' | 'some' | 'confident' }
  | { type: 'SET_ALL_ASSESSMENTS'; assessments: Record<string, 'new' | 'some' | 'confident'> }
  | { type: 'ADD_UPLOADED_DOC'; docId: string }
  | { type: 'ADD_PROCESSING_JOB'; jobId: string }
  | { type: 'SET_PLAN_DRAFT'; plan: PlanDraftData | null }
  | { type: 'ADD_PLAN_ACTIVITY'; dayIndex: number; activity: PlanDraftActivity }
  | { type: 'REMOVE_PLAN_ACTIVITY'; dayIndex: number; activityIndex: number }
  | { type: 'UPDATE_PLAN_ACTIVITY'; dayIndex: number; activityIndex: number; updates: Partial<Omit<PlanDraftActivity, 'id'>> }
  | { type: 'MOVE_PLAN_ACTIVITY'; fromDayIndex: number; fromActivityIndex: number; toDayIndex: number }
  | { type: 'REORDER_PLAN_ACTIVITY'; dayIndex: number; fromIndex: number; direction: 'up' | 'down' }
  | { type: 'CLEAR_PLAN_DAY'; dayIndex: number }
  | { type: 'APPEND_SUBJECT'; subject: DraftSubject }
  | { type: 'SET_PLAN_DAY_ACTIVITIES'; dayIndex: number; activities: PlanDraftActivity[] }

// ─── Initial State ──────────────────────────────────────────────

export const initialWizardDraft: WizardDraft = {
  profileMode: 'study',
  examType: null,
  name: '',
  examDate: '',
  noDeadline: false,
  weeklyTargetHours: 20,
  profileId: null,
  landscapeSource: null,
  subjects: [],
  researchQuestion: '',
  researchStage: null,
  assessments: {},
  uploadedDocumentIds: [],
  processingJobIds: [],
  planDraft: null,
  currentStep: 1,
}

// ─── Helpers ────────────────────────────────────────────────────

/** Normalize weights so they sum to 100 */
function normalizeWeights(subjects: DraftSubject[]): DraftSubject[] {
  if (subjects.length === 0) return subjects
  const total = subjects.reduce((sum, s) => sum + s.weight, 0)
  if (total === 0 || total === 100) return subjects
  return subjects.map(s => ({ ...s, weight: Math.round((s.weight / total) * 100) }))
}

// ─── Reducer ────────────────────────────────────────────────────

export function wizardReducer(state: WizardDraft, action: WizardAction): WizardDraft {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step }

    case 'SET_PROFILE_MODE':
      return { ...state, profileMode: action.mode }

    case 'SET_EXAM_TYPE':
      return { ...state, examType: action.examType }

    case 'SET_NAME':
      return { ...state, name: action.name }

    case 'SET_EXAM_DATE':
      return { ...state, examDate: action.date }

    case 'SET_NO_DEADLINE':
      return {
        ...state,
        noDeadline: action.noDeadline,
        examDate: action.noDeadline ? '' : state.examDate,
      }

    case 'SET_WEEKLY_HOURS':
      return { ...state, weeklyTargetHours: action.hours }

    case 'SET_PROFILE_ID':
      return { ...state, profileId: action.profileId }

    case 'SET_LANDSCAPE_SOURCE':
      return { ...state, landscapeSource: action.source }

    case 'SET_SUBJECTS':
      return { ...state, subjects: normalizeWeights(action.subjects) }

    case 'ADD_SUBJECT':
      return { ...state, subjects: normalizeWeights([...state.subjects, action.subject]) }

    case 'UPDATE_SUBJECT':
      return {
        ...state,
        subjects: state.subjects.map(s => s.tempId === action.tempId ? { ...s, ...action.updates } : s),
      }

    case 'REMOVE_SUBJECT':
      return {
        ...state,
        subjects: normalizeWeights(state.subjects.filter(s => s.tempId !== action.tempId)),
      }

    case 'ADD_TOPIC':
      return {
        ...state,
        subjects: state.subjects.map(s =>
          s.tempId === action.subjectTempId
            ? { ...s, topics: [...s.topics, action.topic] }
            : s
        ),
      }

    case 'UPDATE_TOPIC':
      return {
        ...state,
        subjects: state.subjects.map(s =>
          s.tempId === action.subjectTempId
            ? {
                ...s,
                topics: s.topics.map(t =>
                  t.tempId === action.topicTempId ? { ...t, name: action.name } : t
                ),
              }
            : s
        ),
      }

    case 'REMOVE_TOPIC':
      return {
        ...state,
        subjects: state.subjects.map(s =>
          s.tempId === action.subjectTempId
            ? { ...s, topics: s.topics.filter(t => t.tempId !== action.topicTempId) }
            : s
        ),
      }

    case 'SET_RESEARCH_QUESTION':
      return { ...state, researchQuestion: action.question }

    case 'SET_RESEARCH_STAGE':
      return { ...state, researchStage: action.stage }

    case 'SET_ASSESSMENT':
      return { ...state, assessments: { ...state.assessments, [action.key]: action.level } }

    case 'SET_ALL_ASSESSMENTS':
      return { ...state, assessments: action.assessments }

    case 'ADD_UPLOADED_DOC':
      return { ...state, uploadedDocumentIds: [...state.uploadedDocumentIds, action.docId] }

    case 'ADD_PROCESSING_JOB':
      return { ...state, processingJobIds: [...state.processingJobIds, action.jobId] }

    case 'SET_PLAN_DRAFT':
      return { ...state, planDraft: action.plan }

    case 'ADD_PLAN_ACTIVITY': {
      if (!state.planDraft) return state
      const days = [...state.planDraft.days]
      days[action.dayIndex] = {
        ...days[action.dayIndex],
        activities: [...days[action.dayIndex].activities, action.activity],
      }
      return { ...state, planDraft: { ...state.planDraft, days } }
    }

    case 'REMOVE_PLAN_ACTIVITY': {
      if (!state.planDraft) return state
      const days = [...state.planDraft.days]
      days[action.dayIndex] = {
        ...days[action.dayIndex],
        activities: days[action.dayIndex].activities.filter((_, i) => i !== action.activityIndex),
      }
      return { ...state, planDraft: { ...state.planDraft, days } }
    }

    case 'UPDATE_PLAN_ACTIVITY': {
      if (!state.planDraft) return state
      const days = [...state.planDraft.days]
      const activities = [...days[action.dayIndex].activities]
      activities[action.activityIndex] = { ...activities[action.activityIndex], ...action.updates }
      days[action.dayIndex] = { ...days[action.dayIndex], activities }
      return { ...state, planDraft: { ...state.planDraft, days } }
    }

    case 'MOVE_PLAN_ACTIVITY': {
      if (!state.planDraft) return state
      const days = [...state.planDraft.days]
      const fromDay = { ...days[action.fromDayIndex] }
      const activity = fromDay.activities[action.fromActivityIndex]
      fromDay.activities = fromDay.activities.filter((_, i) => i !== action.fromActivityIndex)
      days[action.fromDayIndex] = fromDay
      const toDay = { ...days[action.toDayIndex] }
      toDay.activities = [...toDay.activities, activity]
      days[action.toDayIndex] = toDay
      return { ...state, planDraft: { ...state.planDraft, days } }
    }

    case 'REORDER_PLAN_ACTIVITY': {
      if (!state.planDraft) return state
      const days = [...state.planDraft.days]
      const activities = [...days[action.dayIndex].activities]
      const toIndex = action.direction === 'up' ? action.fromIndex - 1 : action.fromIndex + 1
      if (toIndex < 0 || toIndex >= activities.length) return state
      ;[activities[action.fromIndex], activities[toIndex]] = [activities[toIndex], activities[action.fromIndex]]
      days[action.dayIndex] = { ...days[action.dayIndex], activities }
      return { ...state, planDraft: { ...state.planDraft, days } }
    }

    case 'CLEAR_PLAN_DAY': {
      if (!state.planDraft) return state
      const days = [...state.planDraft.days]
      days[action.dayIndex] = { ...days[action.dayIndex], activities: [] }
      return { ...state, planDraft: { ...state.planDraft, days } }
    }

    case 'APPEND_SUBJECT':
      return { ...state, subjects: normalizeWeights([...state.subjects, action.subject]) }

    case 'SET_PLAN_DAY_ACTIVITIES': {
      if (!state.planDraft) return state
      const days = [...state.planDraft.days]
      if (action.dayIndex < days.length) {
        days[action.dayIndex] = { ...days[action.dayIndex], activities: action.activities }
      }
      return { ...state, planDraft: { ...state.planDraft, days } }
    }

    default:
      return state
  }
}

// ─── Hook ───────────────────────────────────────────────────────

export function useWizardDraft() {
  const [draft, dispatch] = useReducer(wizardReducer, initialWizardDraft)

  const goToStep = useCallback((step: WizardStep) => {
    dispatch({ type: 'SET_STEP', step })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return { draft, dispatch, goToStep }
}
