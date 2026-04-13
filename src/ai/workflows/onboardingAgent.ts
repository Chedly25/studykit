/**
 * LLM-powered conversational onboarding agent.
 * Replaces the scripted state machine with a real AI conversation.
 * The AI calls tools to render widgets and execute DB writes.
 */
import type { ToolDefinition } from '../types'
import type { ExamType, Subject, Chapter, Topic, TeachingStyle, ExplanationApproach, FeedbackTone } from '../../db/schema'
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
  certificationId: string | null
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
    certificationId: null,
  }
}

// ─── System Prompt ────────────────────────────────────────

export function buildOnboardingSystemPrompt(): string {
  const lang = i18n.language ?? 'en'
  const langName = lang.startsWith('fr') ? 'French' : 'English'
  return `You are the onboarding assistant for StudiesKit. Respond in ${langName} only. Never use emojis.

You MUST use your tools to collect information. Do NOT describe options as text — call the appropriate tool instead.

## Mandatory Tool Usage
- When you need a date: CALL show_date_picker. Do not ask the user to type a date.
- When the user wants to upload files: CALL show_file_upload. Do not describe upload as an option.
- When you need weekly hours: CALL show_hours_slider. Do not ask the user to type a number.
- When you have detected topics: CALL show_topic_preview. Do not list topics as text.
- As soon as you know the exam name: CALL detect_known_exam.
- As soon as you have exam name + type + date: CALL create_study_profile.
- When topics are confirmed: CALL seed_topics.
- When you learn strengths/weaknesses: CALL save_student_assessment.
- When you learn how they prefer to study: CALL set_tutor_preferences.
- When hours are set: CALL set_weekly_hours.
- When everything is done: CALL finish_onboarding.

## Flow
1. Greet briefly. Ask what they're preparing for.
2. They respond → CALL detect_known_exam immediately.
3. CALL show_date_picker to get the exam date.
4. CALL create_study_profile with exam name, type, date.
5. If detect_known_exam found topics → CALL show_topic_preview to show them.
   - If the student says the topics are wrong, incomplete, or wants to change them: offer to upload their own syllabus (CALL show_file_upload). When they upload, CALL extract_topics_from_text with the uploaded content, then CALL show_topic_preview with the new results.
   - If detect_known_exam did NOT find topics → CALL show_file_upload so they can upload materials, OR ask them to describe their subjects and then CALL extract_topics_from_text.
6. Ask about strengths and weaknesses → CALL save_student_assessment.
7. Ask ONE quick question about how they prefer to learn (e.g., "Do you prefer concise or detailed explanations? Do you learn best through examples, analogies, or step-by-step definitions?"). CALL set_tutor_preferences based on their answer.
8. CALL show_hours_slider for weekly hours.
9. CALL seed_topics, CALL set_weekly_hours, then CALL finish_onboarding.

## ExamType inference
- Bar, MCAT, LSAT, GRE, GMAT, CPA, CFA, USMLE, NCLEX, PE, FE, Concours, CRFPA, CPGE, Agregation, CAPES → "professional-exam"
- AWS, Azure, GCP, CompTIA, Cisco, Kubernetes, Terraform, Databricks, Snowflake, Docker, PMP, ITIL and other tech certifications → "professional-exam"
- DELF, DALF, TOEFL, IELTS, TOEIC, HSK, JLPT → "language-learning"
- PhD, thesis, dissertation, qualifying exam → "graduate-research"
- university, course, class, semester, module, AP, Bac → "university-course"
- otherwise → "custom"

## Style
- Keep messages to 2-3 sentences max. Be warm but concise.
- Process multiple pieces of info at once if the student volunteers them.
- Respond in ${langName}. No emojis.`
}

// ─── Tool Definitions ─────────────────────────────────────

export const WIDGET_TOOLS = new Set([
  'show_date_picker', 'show_file_upload', 'show_hours_slider', 'show_topic_preview',
])

export const onboardingToolDefs: ToolDefinition[] = [
  {
    name: 'detect_known_exam',
    description: 'Check if this exam/course/certification is in our database. Covers 60+ tech certifications (AWS, Azure, GCP, Databricks, Kubernetes, CompTIA, HashiCorp, Cisco, etc.) plus academic and professional exams. Returns topic structure if known. Call this early.',
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
    name: 'set_tutor_preferences',
    description: 'Store the student\'s preferred learning style. Call after asking how they prefer to learn.',
    input_schema: {
      type: 'object',
      properties: {
        teachingStyle: { type: 'string', enum: ['concise', 'detailed'], description: 'Concise or detailed explanations' },
        explanationApproach: { type: 'string', enum: ['analogies-first', 'definitions-first', 'examples-first', 'step-by-step'], description: 'How to explain concepts' },
        feedbackTone: { type: 'string', enum: ['encouraging', 'direct'], description: 'Encouraging or direct feedback' },
      },
      required: ['teachingStyle', 'explanationApproach', 'feedbackTone'],
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
  extractedSubjects: ExtractedSubject[]
  certificationId: string | null
  setProfileId: (id: string) => void
  setExtractedSubjects: (subjects: ExtractedSubject[]) => void
  setCertificationId: (id: string) => void
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
        // Check certification catalog first (instant, no API call needed)
        const { findCertification } = await import('../../data/certifications')
        const cert = findCertification(input.examName as string)
        if (cert) {
          ctx.setExtractedSubjects(cert.subjects)
          ctx.setCertificationId(cert.id)
          const subjectNames = cert.subjects.map(s => `${s.name} (${s.weight}%)`).join(', ')
          const retireNote = cert.retirementDate ? `\n\nNote: This exam is retiring on ${cert.retirementDate}.${cert.replacedBy ? ' Consider the replacement exam.' : ''}` : ''
          return { type: 'result', content: `${cert.vendor} ${cert.certName} (${cert.certCode}) recognized from our official catalog!\n\nOfficial domains: ${subjectNames}\n\nExam: ${cert.questionCountTotal} questions, ${cert.totalDurationMinutes} min, passing ${cert.scoringScale.passing}/${cert.scoringScale.max}${retireNote}\n\nCall show_topic_preview to show them to the student, then seed_topics to confirm.` }
        }

        // Fall through to web search + LLM path for non-catalog exams
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
      // Prefer ctx.extractedSubjects (from detect_known_exam/extract_topics_from_text)
      // over the AI's freestyle subjects array which may have wrong structure
      return {
        type: 'widget',
        widgetType: 'topic-preview',
        config: { subjects: ctx.extractedSubjects.length > 0 ? ctx.extractedSubjects : input.subjects },
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
        if (!ext.name) continue // Skip subjects with missing names
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
          dbChapters.push({ id: chapterId, subjectId, examProfileId: profileId, name: ch.name || `Chapter ${ci + 1}`, order: ci })

          for (const topic of ch.topics) {
            if (!topic.name) continue // Skip topics with missing names
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

      // Auto-configure exam format and intelligence for catalog certifications
      if (ctx.certificationId) {
        const { findCertificationById } = await import('../../data/certifications')
        const cert = findCertificationById(ctx.certificationId)
        if (cert) {
          for (let i = 0; i < cert.formats.length; i++) {
            await db.examFormats.put({
              id: crypto.randomUUID(),
              examProfileId: profileId,
              ...cert.formats[i],
              order: i,
            })
          }
          await db.examProfiles.update(profileId, {
            examIntelligence: JSON.stringify(cert.examIntelligence),
            passingThreshold: cert.passingThresholdPercent,
          })
        }
      }

      return { type: 'result', content: `Seeded ${dbSubjects.length} subjects with ${dbTopics.length} topics.${ctx.certificationId ? ' Exam format and passing threshold auto-configured from certification catalog.' : ''}` }
    }

    case 'save_student_assessment': {
      if (!ctx.profileId) return { type: 'result', content: 'Error: profile not created yet.' }
      const strong = (input.strong as string[]) ?? []
      const weak = (input.weak as string[]) ?? []
      const experience = (input.experience as string) ?? ''
      const notes: string[] = []
      if (experience) notes.push(`Experience: ${experience}`)
      if (strong.length > 0) notes.push(`Self-reported strengths: ${strong.join(', ')}`)
      if (weak.length > 0) notes.push(`Self-reported weaknesses: ${weak.join(', ')}`)

      // Merge with existing model if present (avoid overwriting tutor-built data)
      const existing = await db.studentModels.get(ctx.profileId)
      if (existing) {
        const existingNotes: string[] = JSON.parse(existing.personalityNotes || '[]')
        await db.studentModels.update(ctx.profileId, {
          personalityNotes: JSON.stringify([...existingNotes, ...notes]),
          updatedAt: new Date().toISOString(),
        })
      } else {
        await db.studentModels.put({
          id: ctx.profileId,
          examProfileId: ctx.profileId,
          learningStyle: '{}',
          commonMistakes: '[]',
          personalityNotes: JSON.stringify(notes),
          preferredExplanations: '[]',
          motivationTriggers: '[]',
          updatedAt: new Date().toISOString(),
        })
      }
      return { type: 'result', content: 'Student assessment saved.' }
    }

    case 'set_tutor_preferences': {
      if (!ctx.profileId) return { type: 'result', content: 'Error: profile not created yet.' }
      await db.tutorPreferences.put({
        id: ctx.profileId,
        examProfileId: ctx.profileId,
        teachingStyle: (input.teachingStyle as TeachingStyle) ?? 'detailed',
        explanationApproach: (input.explanationApproach as ExplanationApproach) ?? 'step-by-step',
        feedbackTone: (input.feedbackTone as FeedbackTone) ?? 'encouraging',
        languageLevel: 'beginner-friendly',
      })
      return { type: 'result', content: 'Tutor preferences saved.' }
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
