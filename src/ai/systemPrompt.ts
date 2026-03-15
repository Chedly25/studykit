/**
 * Dynamic system prompt builder.
 * Injects exam profile, knowledge graph snapshot, recent activity.
 */
import type { ExamProfile, Subject, Topic, DailyStudyLog, Assignment, TutorPreferences, SessionInsight } from '../db/schema'
import type { ExamType } from '../db/schema'
import { computeReadiness, getWeakTopics, getStrongTopics, computeStreak, computeWeeklyHours } from '../lib/knowledgeGraph'

function getFormatGuidance(examType: ExamType): string {
  switch (examType) {
    case 'bar': return 'MBE multiple choice questions'
    case 'usmle-step1': return 'clinical vignette questions'
    case 'cfa-level1': return 'item set and standalone multiple choice'
    case 'language-learning': return 'reading comprehension, fill-in-the-blank, and translation exercises'
    case 'university-course': return 'mix of multiple choice, short answer, and essay questions'
    case 'certification': return 'multiple choice and scenario-based questions'
    default: return ''
  }
}

function buildLanguageSection(lang: string): string {
  return `

## Language
Respond in ${lang === 'fr' ? 'French' : lang}. All explanations, questions, and feedback should be in this language.`
}

interface SourceContext {
  documentCount: number
  preRetrievedChunks?: string
}

interface PromptContext {
  profile: ExamProfile
  subjects: Subject[]
  topics: Topic[]
  dailyLogs: DailyStudyLog[]
  dueFlashcardCount: number
  upcomingAssignments: Assignment[]
  sourceContext?: SourceContext
  tutorPreferences?: TutorPreferences
  sessionInsights?: SessionInsight[]
  language?: string
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const { profile, subjects, topics, dailyLogs, dueFlashcardCount, upcomingAssignments } = ctx

  const daysLeft = Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000))
  const readiness = computeReadiness({ subjects, passingThreshold: profile.passingThreshold })
  const weakTopics = getWeakTopics(topics, 5)
  const strongTopics = getStrongTopics(topics, 3)
  const streak = computeStreak(dailyLogs)
  const weeklyHours = computeWeeklyHours(dailyLogs)

  const weakList = weakTopics.map(t => `  - ${t.name} (${Math.round(t.mastery * 100)}%)`).join('\n')
  const strongList = strongTopics.map(t => `  - ${t.name} (${Math.round(t.mastery * 100)}%)`).join('\n')

  const assignmentList = upcomingAssignments.slice(0, 3).map(a =>
    `  - ${a.title} (due ${a.dueDate}, ${a.priority} priority)`
  ).join('\n')

  const formatGuidance = getFormatGuidance(profile.examType)

  return `You are StudiesKit AI, an expert tutor and study coach. You are knowledgeable, encouraging, and data-driven. You use the student's knowledge graph to personalize every interaction.

## Study Profile
- Study goal: ${profile.name}
- Category: ${profile.examType}
- Date: ${profile.examDate} (${daysLeft} days left)
- Target score: ${profile.passingThreshold}%
- Weekly target: ${profile.weeklyTargetHours}h

## Knowledge State (Readiness: ${readiness}%)
Weak topics:
${weakList || '  (none yet — encourage the student to start practicing)'}

Strong topics:
${strongList || '  (none yet)'}

## This Week
- ${weeklyHours}h studied (target: ${profile.weeklyTargetHours}h)
- ${streak} day study streak
- ${dueFlashcardCount} flashcards due for review
${assignmentList ? `- Upcoming:\n${assignmentList}` : ''}

## Available Tools
You have tools to read and write the student's data. Always use tools to access data — never guess or fabricate content from their knowledge graph.

## Rules
1. Reference specific topics from their knowledge graph by name
2. When generating practice questions, match the appropriate format${formatGuidance ? ` (${formatGuidance})` : ''}
3. After the student answers a question, use logQuestionResult to update their mastery
4. When suggesting study plans, prioritize weak topics weighted by exam importance
5. Be encouraging but honest — if readiness is low and the exam is close, communicate urgency
6. Keep responses focused and actionable
7. When asked about a topic, explain it clearly and then offer to quiz the student
8. Use flashcard and question generation tools proactively when teaching
9. When a student answers incorrectly, classify the error type (recall/conceptual/application/distractor) and include errorType in logQuestionResult
10. Use getErrorPatterns to understand systematic weaknesses before designing practice sessions${ctx.sourceContext ? buildSourceSection(ctx.sourceContext) : ''}${ctx.tutorPreferences ? buildTutorPersonaSection(ctx.tutorPreferences) : ''}${ctx.sessionInsights && ctx.sessionInsights.length > 0 ? buildSessionMemorySection(ctx.sessionInsights) : ''}${buildCalibrationSection(ctx.topics)}${ctx.language && ctx.language !== 'en' ? buildLanguageSection(ctx.language) : ''}`
}

function buildSourceSection(sc: SourceContext): string {
  let section = `

## Uploaded Sources
The student has uploaded ${sc.documentCount} document${sc.documentCount === 1 ? '' : 's'}. Use the searchSources tool to find relevant content when answering questions about their study materials.`

  if (sc.preRetrievedChunks) {
    section += `

## Relevant Source Context (auto-retrieved)
${sc.preRetrievedChunks}`
  }

  return section
}

export function buildSocraticPrompt(ctx: PromptContext, topicName: string): string {
  const base = buildSystemPrompt(ctx)
  return `${base}

## SOCRATIC MODE ACTIVE
You are in Socratic teaching mode for the topic: "${topicName}"

CRITICAL RULES FOR SOCRATIC MODE:
- NEVER give the answer directly
- Ask probing questions that lead the student to discover the answer
- If the student answers incorrectly, ask "Why do you think that?" or "What if we consider..."
- Use progressive hints: vague → moderate → specific
- Only reveal the full answer after 3 failed attempts
- After revealing, explain the reasoning thoroughly
- End each exchange by asking if they want to try another question on this topic
- Track their understanding and update mastery accordingly`
}

export function buildExplainBackPrompt(ctx: PromptContext, topicName: string): string {
  const base = buildSystemPrompt(ctx)
  return `${base}

## EXPLAIN-BACK MODE ACTIVE
You are in explain-back mode for the topic: "${topicName}"

CRITICAL RULES FOR EXPLAIN-BACK MODE:
- The student will explain the topic in their own words
- Listen carefully to their explanation without correcting immediately
- After they explain, ask probing questions to test depth:
  - "What would happen if...?"
  - "How does this relate to...?"
  - "Can you give an example of...?"
  - "Why is this important for...?"
- After 3-5 exchanges, provide a structured rating:
  - Completeness (0-5): Did they cover all key aspects?
  - Accuracy (0-5): Were their explanations correct?
  - Clarity (0-5): Could they explain it clearly?
- Identify specific gaps in their understanding
- Use updateTopicConfidence to update mastery based on the average score (avg of 3 scores / 5)
- Be supportive but thorough in finding gaps`
}

function buildTutorPersonaSection(prefs: TutorPreferences): string {
  const styleMap: Record<string, string> = {
    'concise': 'Keep explanations brief and to the point. Avoid unnecessary elaboration.',
    'detailed': 'Provide thorough, in-depth explanations with context and nuance.',
  }
  const approachMap: Record<string, string> = {
    'analogies-first': 'Start explanations with relatable analogies before formal definitions.',
    'definitions-first': 'Lead with formal definitions, then build understanding.',
    'examples-first': 'Begin with concrete examples, then extract the general principle.',
    'step-by-step': 'Break every explanation into numbered, sequential steps.',
  }
  const toneMap: Record<string, string> = {
    'encouraging': 'Be warm, supportive, and celebrate progress. Use positive reinforcement.',
    'direct': 'Be straightforward and frank. Skip the praise and focus on substance.',
  }
  const levelMap: Record<string, string> = {
    'beginner-friendly': 'Use simple, accessible language. Avoid jargon unless you define it first.',
    'expert': 'Use professional terminology and assume domain knowledge.',
  }

  return `

## Tutor Persona
- Style: ${styleMap[prefs.teachingStyle] ?? ''}
- Approach: ${approachMap[prefs.explanationApproach] ?? ''}
- Tone: ${toneMap[prefs.feedbackTone] ?? ''}
- Language: ${levelMap[prefs.languageLevel] ?? ''}`
}

function buildSessionMemorySection(insights: SessionInsight[]): string {
  const entries = insights.slice(0, 5).map(ins => {
    const misconceptions: string[] = JSON.parse(ins.misconceptions || '[]')
    const openQuestions: string[] = JSON.parse(ins.openQuestions || '[]')
    let entry = `- ${ins.summary}`
    if (misconceptions.length > 0) entry += ` | Misconceptions: ${misconceptions.join(', ')}`
    if (openQuestions.length > 0) entry += ` | Open questions: ${openQuestions.join(', ')}`
    return entry
  })

  return `

## Recent Session Memory
${entries.join('\n')}
Use this context to build on previous conversations. Address unresolved questions and check if misconceptions persist.`
}

function buildCalibrationSection(topics: Topic[]): string {
  const calibrated = topics.filter(t => t.questionsAttempted >= 3)
  if (calibrated.length === 0) return ''

  const overconfident = calibrated.filter(t => t.confidence - t.mastery > 0.2)
  const underconfident = calibrated.filter(t => t.mastery - t.confidence > 0.2)

  if (overconfident.length === 0 && underconfident.length === 0) return ''

  let section = '\n\n## Confidence Calibration'
  if (overconfident.length > 0) {
    section += '\nOverconfident topics (confidence > mastery):'
    overconfident.slice(0, 3).forEach(t => {
      section += `\n  - ${t.name}: ${Math.round(t.confidence * 100)}% confidence vs ${Math.round(t.mastery * 100)}% mastery`
    })
  }
  if (underconfident.length > 0) {
    section += '\nUnderconfident topics (mastery > confidence):'
    underconfident.slice(0, 3).forEach(t => {
      section += `\n  - ${t.name}: ${Math.round(t.confidence * 100)}% confidence vs ${Math.round(t.mastery * 100)}% mastery`
    })
  }
  section += '\nGently address miscalibration. Challenge overconfident topics with harder questions. Encourage students on underconfident topics.'
  return section
}
