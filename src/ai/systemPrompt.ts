/**
 * Dynamic system prompt builder.
 * Injects exam profile, knowledge graph snapshot, recent activity.
 */
import type { ExamProfile, Subject, Topic, DailyStudyLog, Assignment } from '../db/schema'
import { computeReadiness, getWeakTopics, getStrongTopics, computeStreak, computeWeeklyHours } from '../lib/knowledgeGraph'

interface PromptContext {
  profile: ExamProfile
  subjects: Subject[]
  topics: Topic[]
  dailyLogs: DailyStudyLog[]
  dueFlashcardCount: number
  upcomingAssignments: Assignment[]
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

  return `You are StudiesKit AI, an expert tutor for professional exam preparation. You are knowledgeable, encouraging, and data-driven. You use the student's knowledge graph to personalize every interaction.

## Exam Profile
- Exam: ${profile.name}
- Type: ${profile.examType}
- Date: ${profile.examDate} (${daysLeft} days left)
- Passing threshold: ${profile.passingThreshold}%
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
2. When generating practice questions, match the exam format (MBE multiple choice for bar, clinical vignettes for USMLE, etc.)
3. After the student answers a question, use logQuestionResult to update their mastery
4. When suggesting study plans, prioritize weak topics weighted by exam importance
5. Be encouraging but honest — if readiness is low and the exam is close, communicate urgency
6. Keep responses focused and actionable
7. When asked about a topic, explain it clearly and then offer to quiz the student
8. Use flashcard and question generation tools proactively when teaching`
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
