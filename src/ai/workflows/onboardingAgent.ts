/**
 * LLM-powered conversational onboarding agent.
 * Replaces the scripted state machine with a real AI conversation.
 * The AI calls tools to render widgets and execute DB writes.
 */
import type { ToolDefinition } from '../types'
import type { ExamType, Subject, Chapter, Topic } from '../../db/schema'
import type { ExtractedSubject } from '../topicExtractor'
import { db } from '../../db'
import { getExamBlueprint } from '../../lib/examTopicMaps'
import i18n from '../../i18n'

// ─── Types ────────────────────────────────────────────────

export interface DisplayMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  widget?: { type: string; config: Record<string, unknown> }
}

export interface PendingWidget {
  type: 'date-input' | 'file-upload' | 'slider' | 'topic-preview' | 'summary'
  config: Record<string, unknown>
  toolCallId: string
}

export interface ConversationalOnboardingState {
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>
  displayMessages: DisplayMessage[]
  profileId: string | null
  examName: string
  extractedSubjects: ExtractedSubject[]
  topicsSeeded: boolean
  weeklyHoursSet: boolean
  completed: boolean
  pendingWidget: PendingWidget | null
  isStreaming: boolean
  streamingText: string
  error: string | null
  useFallback: boolean
}

export function createInitialConversationalState(): ConversationalOnboardingState {
  return {
    messages: [],
    displayMessages: [],
    profileId: null,
    examName: '',
    extractedSubjects: [],
    topicsSeeded: false,
    weeklyHoursSet: false,
    completed: false,
    pendingWidget: null,
    isStreaming: false,
    streamingText: '',
    error: null,
    useFallback: false,
  }
}

// ─── System Prompt ────────────────────────────────────────

export function buildOnboardingSystemPrompt(): string {
  const lang = i18n.language ?? 'en'
  return `You are the onboarding assistant for StudiesKit, a premium AI-powered study platform.

[User language preference: ${lang}]

## Your Goal
Help the student set up their personalized study plan by gathering:
1. What they're preparing for (exam name, course)
2. When (exam date, if applicable)
3. Their self-assessment (strengths, weaknesses, experience)
4. Their study materials (upload docs, describe topics, or use standard)
5. Weekly study capacity (hours per week)

## Personality
- Warm, encouraging, concise
- ALWAYS respond in the language the student writes in. If they write in French, respond in French. If English, respond in English.
- One question at a time — don't overwhelm
- Keep messages to 2-3 sentences max
- Be smart about what the student tells you — if they mention multiple things at once, process them all

## Conversation Flow
1. Start by greeting the student and asking what they're preparing for
2. Once you know the exam/course name, call detect_known_exam to check our database
3. Ask for the exam date — call show_date_picker
4. Call create_study_profile once you have exam name + type + date
5. Handle materials: if known exam detected, call show_topic_preview with the detected subjects. Otherwise ask if they want to upload documents or describe their topics.
6. Ask about their experience — what feels strong, what worries them. Call save_student_assessment.
7. Ask about weekly hours — call show_hours_slider
8. Call seed_topics + set_weekly_hours, then call finish_onboarding

## Rules
- Call detect_known_exam as early as possible — many exams are in our database
- For create_study_profile, infer examType from the exam name:
  * Bar, MCAT, LSAT, GRE, GMAT, CPA, CFA, USMLE, NCLEX, PE, FE, Concours, CRFPA, CPGE, Agrégation, CAPES → "professional-exam"
  * DELF, DALF, TOEFL, IELTS, TOEIC, HSK, JLPT → "language-learning"
  * PhD, thesis, dissertation, qualifying exam → "graduate-research"
  * university, course, class, semester, module, AP, Bac → "university-course"
  * otherwise → "custom"
- You CAN reorder steps based on what the student says naturally
- If the student provides multiple pieces of info at once, process them all in one turn
- Don't repeat information back verbatim — paraphrase and confirm
- Never call finish_onboarding until you have: profile created, topics seeded, and weekly hours set
- NEVER use emojis in your responses. Use plain text only. No emoji characters whatsoever.`
}

// ─── Tool Definitions ─────────────────────────────────────

export const WIDGET_TOOLS = new Set([
  'show_date_picker', 'show_file_upload', 'show_hours_slider', 'show_topic_preview',
])

export const onboardingToolDefs: ToolDefinition[] = [
  {
    name: 'detect_known_exam',
    description: 'Check if this exam/course is in our database. Returns topic structure if known, null if unknown. Call this early.',
    input_schema: {
      type: 'object',
      properties: {
        examName: { type: 'string', description: 'The exam or course name' },
        jurisdiction: { type: 'string', description: 'Optional jurisdiction (e.g., "California" for Bar Exam)' },
      },
      required: ['examName'],
    },
  },
  {
    name: 'create_study_profile',
    description: 'Create the student\'s study profile in the database. Call once you have exam name, type, and date.',
    input_schema: {
      type: 'object',
      properties: {
        examName: { type: 'string' },
        examType: { type: 'string', enum: ['professional-exam', 'university-course', 'graduate-research', 'language-learning', 'custom'] },
        examDate: { type: 'string', description: 'ISO date string (YYYY-MM-DD) or empty if no deadline' },
      },
      required: ['examName', 'examType'],
    },
  },
  {
    name: 'show_date_picker',
    description: 'Render an inline date picker widget for the student to select their exam date.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The question text to show above the date picker' },
      },
      required: ['message'],
    },
  },
  {
    name: 'show_file_upload',
    description: 'Render a file upload widget for the student to upload PDFs (syllabus, course materials, past exams).',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The prompt text' },
      },
      required: ['message'],
    },
  },
  {
    name: 'show_hours_slider',
    description: 'Render a slider widget for the student to set their weekly study hours (5-40h).',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The question text' },
        defaultValue: { type: 'number', description: 'Default slider value (default 15)' },
      },
      required: ['message'],
    },
  },
  {
    name: 'show_topic_preview',
    description: 'Render a topic preview widget showing the detected subjects and topics for confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message to show above the preview' },
        subjects: { type: 'array', description: 'Array of subjects with topics to preview' },
      },
      required: ['message', 'subjects'],
    },
  },
  {
    name: 'extract_topics_from_text',
    description: 'Extract subjects and topics from a free-text description of the course/exam.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'The student\'s description of what they study' },
      },
      required: ['description'],
    },
  },
  {
    name: 'seed_topics',
    description: 'Populate the profile with the extracted or detected subjects and topics.',
    input_schema: {
      type: 'object',
      properties: {
        subjects: { type: 'array', description: 'The subjects array to seed' },
      },
      required: ['subjects'],
    },
  },
  {
    name: 'save_student_assessment',
    description: 'Store the student\'s self-assessment (strengths, weaknesses, experience level).',
    input_schema: {
      type: 'object',
      properties: {
        strong: { type: 'array', items: { type: 'string' }, description: 'Topics/areas the student feels confident in' },
        weak: { type: 'array', items: { type: 'string' }, description: 'Topics/areas the student struggles with' },
        experience: { type: 'string', description: 'Brief description of their experience level' },
      },
      required: ['strong', 'weak', 'experience'],
    },
  },
  {
    name: 'set_weekly_hours',
    description: 'Set the weekly study target hours and trigger study plan generation.',
    input_schema: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'Weekly study hours (5-40)' },
      },
      required: ['hours'],
    },
  },
  {
    name: 'finish_onboarding',
    description: 'Show the summary and complete onboarding. Only call when profile is created, topics are seeded, and hours are set.',
    input_schema: {
      type: 'object',
      properties: {
        examName: { type: 'string' },
        examDate: { type: 'string' },
        subjectCount: { type: 'number' },
        topicCount: { type: 'number' },
        weeklyHours: { type: 'number' },
      },
      required: ['examName', 'subjectCount', 'topicCount', 'weeklyHours'],
    },
  },
]

// ─── Tool Executor ────────────────────────────────────────

export type OnboardingToolResult =
  | { type: 'widget'; widgetType: string; config: Record<string, unknown>; message: string }
  | { type: 'result'; content: string }
  | { type: 'terminal'; summaryData: Record<string, unknown> }

interface ToolContext {
  profileId: string | null
  userId: string
  authToken: string | null
  setProfileId: (id: string) => void
  setExtractedSubjects: (subjects: ExtractedSubject[]) => void
  setTopicsSeeded: (v: boolean) => void
  setWeeklyHoursSet: (v: boolean) => void
  setExamName: (name: string) => void
}

export async function executeOnboardingTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<OnboardingToolResult> {
  switch (toolName) {
    case 'detect_known_exam': {
      try {
        if (!ctx.authToken) return { type: 'result', content: 'No auth token — cannot detect exam. Ask the student to describe their topics.' }
        const { generateKnownExamLandscape } = await import('../landscapeExtractor')
        const result = await generateKnownExamLandscape(
          input.examName as string,
          input.jurisdiction as string | undefined,
          ctx.authToken,
        )
        if (result && result.subjects.length > 0) {
          ctx.setExtractedSubjects(result.subjects)
          const subjectNames = result.subjects.map(s => s.name).join(', ')
          return { type: 'result', content: `Known exam detected! Found ${result.subjects.length} subjects: ${subjectNames}. You can now call show_topic_preview to show them to the student, then seed_topics to confirm.` }
        }
        return { type: 'result', content: 'Exam not in our database. Ask the student to describe their topics or upload materials.' }
      } catch {
        return { type: 'result', content: 'Detection failed. Ask the student to describe their topics instead.' }
      }
    }

    case 'create_study_profile': {
      const examName = input.examName as string
      const examType = (input.examType as ExamType) ?? 'custom'
      const examDate = (input.examDate as string) ?? ''
      const blueprint = getExamBlueprint(examType)
      const profileId = crypto.randomUUID()
      const today = new Date().toISOString().slice(0, 10)

      await db.examProfiles.put({
        id: profileId,
        name: examName,
        examType,
        examDate,
        isActive: false,
        passingThreshold: blueprint.defaultPassingThreshold,
        weeklyTargetHours: 15,
        userId: ctx.userId,
        createdAt: new Date().toISOString(),
        profileMode: 'study',
      })

      // Seed empty blueprint subjects
      const subjects: Subject[] = []
      const chapters: Chapter[] = []
      const topics: Topic[] = []

      for (let si = 0; si < blueprint.subjects.length; si++) {
        const seed = blueprint.subjects[si]
        const subjectId = crypto.randomUUID()
        const chapterId = crypto.randomUUID()

        subjects.push({
          id: subjectId, examProfileId: profileId, name: seed.name,
          weight: seed.weight, mastery: 0, color: seed.color, order: si,
        })
        chapters.push({
          id: chapterId, subjectId, examProfileId: profileId, name: 'General', order: 0,
        })
        for (const seedTopic of seed.topics) {
          topics.push({
            id: crypto.randomUUID(), subjectId, chapterId, examProfileId: profileId,
            name: seedTopic.name, mastery: 0, confidence: 0,
            questionsAttempted: 0, questionsCorrect: 0,
            easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewDate: today,
          })
        }
      }

      if (subjects.length > 0) await db.subjects.bulkPut(subjects)
      if (chapters.length > 0) await db.chapters.bulkPut(chapters)
      if (topics.length > 0) await db.topics.bulkPut(topics)

      ctx.setProfileId(profileId)
      ctx.setExamName(examName)
      return { type: 'result', content: `Profile created (ID: ${profileId}). ${subjects.length} blueprint subjects seeded.` }
    }

    case 'show_date_picker':
      return { type: 'widget', widgetType: 'date-input', config: {}, message: input.message as string }

    case 'show_file_upload':
      return { type: 'widget', widgetType: 'file-upload', config: {}, message: input.message as string }

    case 'show_hours_slider':
      return {
        type: 'widget',
        widgetType: 'slider',
        config: { min: 5, max: 40, step: 5, default: (input.defaultValue as number) ?? 15 },
        message: input.message as string,
      }

    case 'show_topic_preview':
      return {
        type: 'widget',
        widgetType: 'topic-preview',
        config: { subjects: input.subjects },
        message: input.message as string,
      }

    case 'extract_topics_from_text': {
      try {
        if (!ctx.authToken) return { type: 'result', content: 'No auth token for extraction.' }
        const { extractLandscapeFromText } = await import('../landscapeExtractor')
        const result = await extractLandscapeFromText(input.description as string, 'onboarding', 'custom', ctx.authToken)
        if (result && result.subjects.length > 0) {
          ctx.setExtractedSubjects(result.subjects)
          const names = result.subjects.map(s => `${s.name} (${s.topics.length} topics)`).join(', ')
          return { type: 'result', content: `Extracted ${result.subjects.length} subjects: ${names}. Call show_topic_preview to show them, then seed_topics to confirm.` }
        }
        return { type: 'result', content: 'Could not extract topics from the description. Ask the student for more detail.' }
      } catch {
        return { type: 'result', content: 'Extraction failed. Ask the student to try again or describe more specifically.' }
      }
    }

    case 'seed_topics': {
      if (!ctx.profileId) return { type: 'result', content: 'Error: profile not created yet. Call create_study_profile first.' }
      const subjects = input.subjects as ExtractedSubject[]
      if (!subjects || subjects.length === 0) return { type: 'result', content: 'No subjects to seed.' }

      const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4']
      const profileId = ctx.profileId
      const today = new Date().toISOString().slice(0, 10)

      // Clear existing blueprint data
      await db.subtopics.where('examProfileId').equals(profileId).delete()
      await db.topics.where('examProfileId').equals(profileId).delete()
      await db.chapters.where('examProfileId').equals(profileId).delete()
      await db.subjects.where('examProfileId').equals(profileId).delete()

      const dbSubjects: Subject[] = []
      const dbChapters: Chapter[] = []
      const dbTopics: Topic[] = []
      const equalShare = 100 / subjects.length

      for (let si = 0; si < subjects.length; si++) {
        const ext = subjects[si]
        const subjectId = crypto.randomUUID()
        const chs = ext.chapters && ext.chapters.length > 0 ? ext.chapters : [{ name: 'General', topics: ext.topics }]

        dbSubjects.push({
          id: subjectId, examProfileId: profileId, name: ext.name,
          weight: Math.round(ext.weight > 0 ? ext.weight : equalShare),
          mastery: 0, color: COLORS[si % COLORS.length], order: si,
        })

        for (let ci = 0; ci < chs.length; ci++) {
          const ch = chs[ci]
          const chapterId = crypto.randomUUID()
          dbChapters.push({ id: chapterId, subjectId, examProfileId: profileId, name: ch.name, order: ci })

          for (const topic of ch.topics) {
            dbTopics.push({
              id: crypto.randomUUID(), subjectId, chapterId, examProfileId: profileId,
              name: topic.name, mastery: 0, confidence: 0,
              questionsAttempted: 0, questionsCorrect: 0,
              easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewDate: today,
            })
          }
        }
      }

      await db.subjects.bulkPut(dbSubjects)
      await db.chapters.bulkPut(dbChapters)
      await db.topics.bulkPut(dbTopics)
      ctx.setTopicsSeeded(true)
      return { type: 'result', content: `Seeded ${dbSubjects.length} subjects with ${dbTopics.length} topics.` }
    }

    case 'save_student_assessment': {
      if (!ctx.profileId) return { type: 'result', content: 'Error: profile not created yet.' }
      await db.studentModels.put({
        id: ctx.profileId,
        examProfileId: ctx.profileId,
        learningStyle: '{}',
        commonMistakes: '[]',
        personalityNotes: JSON.stringify([input.experience as string]),
        preferredExplanations: '[]',
        motivationTriggers: '[]',
        updatedAt: new Date().toISOString(),
      })
      return { type: 'result', content: 'Student assessment saved.' }
    }

    case 'set_weekly_hours': {
      if (!ctx.profileId) return { type: 'result', content: 'Error: profile not created yet.' }
      const hours = input.hours as number
      await db.examProfiles.update(ctx.profileId, { weeklyTargetHours: hours })
      ctx.setWeeklyHoursSet(true)

      // Non-blocking plan generation
      try {
        const { generateStudyPlan } = await import('../studyPlanGenerator')
        if (ctx.authToken) {
          generateStudyPlan(ctx.profileId, ctx.authToken, 7).catch(() => {})
        }
      } catch { /* non-critical */ }

      return { type: 'result', content: `Weekly target set to ${hours} hours. Study plan generation started.` }
    }

    case 'finish_onboarding': {
      return {
        type: 'terminal',
        summaryData: {
          examName: input.examName,
          examDate: input.examDate ?? '',
          subjectCount: input.subjectCount,
          topicCount: input.topicCount,
          weeklyHours: input.weeklyHours,
        },
      }
    }

    default:
      return { type: 'result', content: `Unknown tool: ${toolName}` }
  }
}
