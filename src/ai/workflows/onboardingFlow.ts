/**
 * Conversational onboarding flow — structured state machine.
 * Each step extracts specific data. Works without LLM via template fallbacks.
 */
import type { ExamType } from '../../db/schema'
import type { ExtractedSubject } from '../topicExtractor'

// ─── Types ────────────────────────────────────────────────

export type OnboardingStep = 'welcome' | 'self-assessment' | 'materials' | 'capacity' | 'summary'

export interface OnboardingState {
  step: OnboardingStep
  subStep: 'exam-name' | 'exam-date' | null
  examName: string
  examType: ExamType | null
  examDate: string
  jurisdiction: string
  selfAssessment: { strong: string[]; weak: string[]; experience: string } | null
  materialsChoice: 'known-exam' | 'upload' | 'describe' | 'standard' | null
  extractedSubjects: ExtractedSubject[]
  topicsExtracted: boolean
  weeklyHours: number | null
  profileId: string | null
  messages: OnboardingMessage[]
  isProcessing: boolean
}

export interface OnboardingMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  widget?: OnboardingWidget
}

export type OnboardingWidget =
  | { type: 'exam-input' }
  | { type: 'date-input' }
  | { type: 'text-area'; placeholder: string }
  | { type: 'file-upload' }
  | { type: 'choice'; options: Array<{ id: string; label: string; description?: string }> }
  | { type: 'slider'; min: number; max: number; step: number; unit: string; defaultValue: number }
  | { type: 'topic-preview'; subjects: ExtractedSubject[] }
  | { type: 'summary'; data: OnboardingSummary }

export interface OnboardingSummary {
  examName: string
  examDate: string
  subjectCount: number
  topicCount: number
  weeklyHours: number
  strongAreas: string[]
  focusAreas: string[]
}

export interface OnboardingAction {
  type: 'create-profile' | 'seed-topics' | 'update-student-model' | 'generate-plan'
  payload: Record<string, unknown>
}

export interface OnboardingInput {
  text?: string
  examType?: ExamType
  examDate?: string
  weeklyHours?: number
  fileText?: string
  choice?: string
  subjects?: ExtractedSubject[]
}

// ─── Initial state ────────────────────────────────────────

export function createInitialState(): OnboardingState {
  return {
    step: 'welcome',
    subStep: 'exam-name',
    examName: '',
    examType: null,
    examDate: '',
    jurisdiction: '',
    selfAssessment: null,
    materialsChoice: null,
    extractedSubjects: [],
    topicsExtracted: false,
    weeklyHours: null,
    profileId: null,
    messages: [{
      id: 'welcome-1',
      role: 'assistant',
      content: "Welcome to StudiesKit! I'm here to set up your personalized study plan. What exam or course are you preparing for?",
      widget: { type: 'exam-input' },
    }],
    isProcessing: false,
  }
}

// ─── Exam type inference ──────────────────────────────────

function inferExamType(name: string): ExamType {
  const lower = name.toLowerCase()
  if (/bar\s*(exam)?|mcat|lsat|gre|gmat|cpa|cfa|usmle|nclex|pe exam|fe exam/i.test(lower)) return 'professional-exam'
  if (/delf|dalf|toefl|ielts|toeic|hsk|jlpt/i.test(lower)) return 'language-learning'
  if (/phd|thesis|dissertation|qualifying/i.test(lower)) return 'graduate-research'
  if (/university|course|class|semester|module/i.test(lower)) return 'university-course'
  if (/ap\s+/i.test(lower)) return 'university-course'
  return 'custom'
}

function inferJurisdiction(name: string): string {
  const match = name.match(/\b(california|new york|texas|florida|illinois|ohio|georgia|virginia|massachusetts|pennsylvania|washington|oregon|colorado|arizona|michigan|minnesota|maryland|wisconsin|missouri|tennessee|indiana|north carolina|south carolina|alabama|kentucky|louisiana|connecticut|oklahoma|iowa|mississippi|arkansas|kansas|utah|nevada|new mexico|hawaii|idaho|maine|montana|nebraska|new hampshire|north dakota|south dakota|rhode island|vermont|west virginia|wyoming|delaware|alaska)\b/i)
  return match ? match[1] : ''
}

// ─── Months calculator ────────────────────────────────────

function monthsUntil(dateStr: string): number {
  if (!dateStr) return 0
  const target = new Date(dateStr)
  const now = new Date()
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)))
}

function timeEncouragement(months: number): string {
  if (months >= 12) return "That's a great head start — plenty of time to build a solid foundation."
  if (months >= 6) return "Good timeline. We'll make every week count."
  if (months >= 3) return "Focused timeline — we'll prioritize what matters most."
  if (months >= 1) return "Tight timeline — let's focus on high-yield topics."
  return "Let's make the most of the time we have."
}

// ─── Message helpers ──────────────────────────────────────

export function msg(role: 'assistant' | 'user', content: string, widget?: OnboardingWidget): OnboardingMessage {
  return { id: crypto.randomUUID(), role, content, widget }
}

// ─── Core processor ───────────────────────────────────────

export function processOnboardingInput(
  input: OnboardingInput,
  state: OnboardingState,
): { newState: OnboardingState; actions: OnboardingAction[] } {
  const actions: OnboardingAction[] = []
  const newMessages = [...state.messages]

  switch (state.step) {
    case 'welcome': {
      if (state.subStep === 'exam-name' && input.text) {
        const examName = input.text.trim()
        const examType = input.examType ?? inferExamType(examName)
        const jurisdiction = inferJurisdiction(examName)

        newMessages.push(msg('user', examName))
        newMessages.push(msg('assistant', `Great choice. When is your ${examName}?`, { type: 'date-input' }))

        return {
          newState: { ...state, examName, examType, jurisdiction, subStep: 'exam-date', messages: newMessages },
          actions,
        }
      }

      if (state.subStep === 'exam-date') {
        const examDate = input.examDate ?? ''
        const months = monthsUntil(examDate)
        const dateLabel = examDate || 'No fixed deadline'

        newMessages.push(msg('user', dateLabel))

        const encouragement = examDate
          ? `That gives us ${months} month${months !== 1 ? 's' : ''} — ${timeEncouragement(months)}`
          : "No deadline — we'll build at your pace."

        newMessages.push(msg(
          'assistant',
          `${encouragement}\n\nTell me about your experience so far. What subjects feel strong, and what worries you?`,
          { type: 'text-area', placeholder: "e.g., I'm comfortable with Contracts and Torts, but Property and Con Law worry me..." },
        ))

        actions.push({
          type: 'create-profile',
          payload: {
            examName: state.examName,
            examType: state.examType ?? 'custom',
            examDate,
          },
        })

        return {
          newState: { ...state, examDate, step: 'self-assessment', subStep: null, messages: newMessages },
          actions,
        }
      }
      break
    }

    case 'self-assessment': {
      if (input.text) {
        const experience = input.text.trim()
        newMessages.push(msg('user', experience))

        // Simple keyword extraction for strong/weak (LLM enhancement in Session 2)
        const assessment = { strong: [] as string[], weak: [] as string[], experience }

        actions.push({
          type: 'update-student-model',
          payload: { selfAssessment: assessment },
        })

        newMessages.push(msg(
          'assistant',
          `Thanks for sharing that. Now let's set up your study topics.\n\nDo you have a syllabus or course outline to upload, or would you like me to set up the standard topics for your exam?`,
          {
            type: 'choice',
            options: [
              { id: 'upload', label: 'Upload a syllabus', description: 'PDF or document with your course structure' },
              { id: 'describe', label: 'Describe my course', description: "I'll type out the main subjects" },
              { id: 'standard', label: 'Use standard topics', description: `Set up typical ${state.examName} subjects` },
            ],
          },
        ))

        return {
          newState: { ...state, selfAssessment: assessment, step: 'materials', subStep: null, messages: newMessages },
          actions,
        }
      }
      break
    }

    case 'materials': {
      // Handle choice selection
      if (input.choice === 'upload') {
        newMessages.push(msg('user', 'Upload a syllabus'))
        newMessages.push(msg('assistant', 'Upload your syllabus or course outline and I\'ll extract the topic structure.', { type: 'file-upload' }))
        return {
          newState: { ...state, materialsChoice: 'upload', messages: newMessages },
          actions,
        }
      }

      if (input.choice === 'describe') {
        newMessages.push(msg('user', 'Describe my course'))
        newMessages.push(msg(
          'assistant',
          'Describe your course subjects and topics. Be as detailed as you like — I\'ll organize them into a study structure.',
          { type: 'text-area', placeholder: 'e.g., The course covers Constitutional Law, Criminal Law, Property Law...' },
        ))
        return {
          newState: { ...state, materialsChoice: 'describe', messages: newMessages },
          actions,
        }
      }

      if (input.choice === 'standard' || input.choice === 'confirm-topics') {
        // Use whatever subjects we have (auto-generated or default)
        const subjects = state.extractedSubjects
        if (subjects.length > 0) {
          actions.push({ type: 'seed-topics', payload: { subjects } })
        }

        const topicCount = subjects.reduce((sum, s) => sum + (s.chapters ?? [{ topics: s.topics }]).reduce((cs, c) => cs + c.topics.length, 0), 0)

        newMessages.push(msg('user', input.choice === 'confirm-topics' ? 'Looks good!' : 'Use standard topics'))
        newMessages.push(msg(
          'assistant',
          `${subjects.length > 0 ? `Set up ${subjects.length} subjects with ${topicCount} topics.` : "I'll set up a basic structure you can customize later."}\n\nHow many hours per week can you dedicate to studying?`,
          { type: 'slider', min: 5, max: 40, step: 5, unit: 'hours/week', defaultValue: 15 },
        ))

        return {
          newState: { ...state, topicsExtracted: subjects.length > 0, step: 'capacity', subStep: null, messages: newMessages },
          actions,
        }
      }

      // Handle file text or description text (extracted/entered content)
      if (input.subjects && input.subjects.length > 0) {
        newMessages.push(msg('user', `Uploaded ${input.subjects.length} subjects`))
        newMessages.push(msg(
          'assistant',
          "Here's what I found. Does this look right?",
          { type: 'topic-preview', subjects: input.subjects },
        ))
        return {
          newState: { ...state, extractedSubjects: input.subjects, messages: newMessages },
          actions,
        }
      }

      if (input.text && state.materialsChoice === 'describe') {
        newMessages.push(msg('user', input.text))
        // Text will be processed by the hook using landscapeExtractor
        // For now, advance to capacity with empty subjects
        newMessages.push(msg(
          'assistant',
          "Got it. I'll organize those into your study structure.\n\nHow many hours per week can you dedicate to studying?",
          { type: 'slider', min: 5, max: 40, step: 5, unit: 'hours/week', defaultValue: 15 },
        ))
        return {
          newState: { ...state, step: 'capacity', subStep: null, messages: newMessages },
          actions,
        }
      }
      break
    }

    case 'capacity': {
      const weeklyHours = input.weeklyHours ?? 15
      newMessages.push(msg('user', `${weeklyHours} hours per week`))

      const subjects = state.extractedSubjects
      const topicCount = subjects.reduce((sum, s) => sum + (s.chapters ?? [{ topics: s.topics }]).reduce((cs, c) => cs + c.topics.length, 0), 0)

      const summary: OnboardingSummary = {
        examName: state.examName,
        examDate: state.examDate,
        subjectCount: subjects.length,
        topicCount,
        weeklyHours,
        strongAreas: state.selfAssessment?.strong ?? [],
        focusAreas: state.selfAssessment?.weak ?? [],
      }

      newMessages.push(msg(
        'assistant',
        `Here's what I've set up for you:`,
        { type: 'summary', data: summary },
      ))

      actions.push({ type: 'generate-plan', payload: { weeklyHours } })

      return {
        newState: { ...state, weeklyHours, step: 'summary', subStep: null, messages: newMessages },
        actions,
      }
    }

    case 'summary':
      // Terminal state — handled by the UI CTAs
      break
  }

  return { newState: state, actions }
}
