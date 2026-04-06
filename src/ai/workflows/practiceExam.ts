/**
 * Practice exam generation workflow — 5 steps:
 * 1. Gather context (DB) — profile, subjects, topics, documents, student model
 * 2. Search documents (optional) — per-topic semantic search for deep source grounding
 * 3. Search web (optional)
 * 4. Generate questions (LLM)
 * 5. Validate questions (LLM, optional)
 */
import * as Sentry from '@sentry/react'
import { db } from '../../db'
import type { GeneratedQuestion } from '../../db/schema'
import { dbQueryStep, webSearchStep, llmJsonStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { getKnowledgeGraph, getWeakTopicsTool, getErrorPatterns } from '../tools/knowledgeState'
import { hybridSearch } from '../../lib/hybridSearch'
import { streamChat } from '../client'

/** Call main model with high token limits for exam question generation */
async function llmHighTokens(prompt: string, system: string, ctx: WorkflowContext): Promise<string> {
  const response = await streamChat({
    messages: [{ id: crypto.randomUUID(), role: 'user', content: prompt }],
    system,
    tools: [],
    maxTokens: 16384,
    authToken: ctx.authToken,
    signal: ctx.signal,
  })
  return response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')
}

export interface SimulationSection {
  examFormatId: string
  formatName: string
  sectionType: 'written' | 'oral' | 'practical'
  timeAllocationMinutes: number
  questionCount: number
  pointWeight: number
  questionFormat?: string
  samplePrompt?: string
  prepTimeMinutes?: number
  instructions?: string
  shuffleQuestions?: boolean
  canGoBack?: boolean
}

export interface PracticeExamConfig {
  sessionId: string
  questionCount: number
  focusSubject?: string
  selectedTopics?: string[]
  customFocus?: string
  examSection?: string
  sourcesEnabled: boolean
  // Simulation mode fields
  simulationMode?: boolean
  sections?: SimulationSection[]
}

interface GeneratedQuestionData {
  text: string
  format: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'vignette'
  options?: string[]
  correctAnswer: string
  correctOptionIndex?: number
  explanation: string
  difficulty: number
  topicName: string
  points: number
  scenarioText?: string
  subQuestions?: Array<{ text: string; correctAnswer: string }>
  sourceReference?: string
}

interface GatherContextResult {
  profileName: string
  examType: string
  examDate: string
  passingThreshold: number
  subjectsList: string
  topicsList: string
  knowledgeGraph: string
  weakTopics: string
  errorPatterns: string
  documentSummaries: string
  documentIds: string[]
  studentModel?: { learningStyle: string; commonMistakes: string }
  examFormats: Array<{ formatName: string; description: string; samplePrompt?: string }>
}

/** Max chars of source content to include from per-topic search (~20K tokens) */
const SOURCE_CONTENT_BUDGET = 80_000

export function createPracticeExamWorkflow(config: PracticeExamConfig): WorkflowDefinition<GeneratedQuestion[]> {
  return {
    id: 'practice-exam-generation',
    name: 'Generate Practice Exam',
    steps: [
      // Step 1: Gather ALL context from DB — this is critical for quality
      dbQueryStep<GatherContextResult>('gatherContext', 'Gathering your study data', async (ctx) => {
        const [profile, subjects, topics, knowledgeGraph, weakTopics, errorPatterns, studentModel, examFormats, documents] = await Promise.all([
          db.examProfiles.get(ctx.examProfileId),
          db.subjects.where('examProfileId').equals(ctx.examProfileId).sortBy('order'),
          db.topics.where('examProfileId').equals(ctx.examProfileId).toArray(),
          getKnowledgeGraph(ctx.examProfileId),
          getWeakTopicsTool(ctx.examProfileId),
          getErrorPatterns(ctx.examProfileId),
          db.studentModels.get(ctx.examProfileId),
          db.examFormats.where('examProfileId').equals(ctx.examProfileId).toArray(),
          db.documents.where('examProfileId').equals(ctx.examProfileId).toArray(),
        ])

        // Build a rich subjects → topics listing
        const subjectsList = subjects.map(s => {
          const subTopics = topics.filter(t => t.subjectId === s.id)
          const topicNames = subTopics.map(t => `    - ${t.name} (mastery: ${Math.round(t.mastery * 100)}%, ${t.questionsAttempted} attempted)`).join('\n')
          return `  ${s.name} (weight: ${s.weight}%, mastery: ${Math.round(s.mastery * 100)}%)\n${topicNames}`
        }).join('\n')

        const topicsList = topics.map(t => t.name).join(', ')

        // Collect document summaries (compact overview) instead of raw chunks
        let documentSummaries = ''
        const documentIds: string[] = []
        if (documents.length > 0) {
          const summaryParts: string[] = []
          for (const doc of documents) {
            documentIds.push(doc.id)
            const summary = doc.summary || '(no summary available)'
            summaryParts.push(`- ${doc.title}: ${summary}`)
          }
          documentSummaries = summaryParts.join('\n')
        }

        return {
          profileName: profile?.name ?? 'Study Profile',
          examType: profile?.examType ?? 'custom',
          examDate: profile?.examDate ?? '',
          passingThreshold: profile?.passingThreshold ?? 60,
          subjectsList,
          topicsList,
          knowledgeGraph,
          weakTopics,
          errorPatterns,
          documentSummaries,
          documentIds,
          studentModel: studentModel ? {
            learningStyle: studentModel.learningStyle,
            commonMistakes: studentModel.commonMistakes,
          } : undefined,
          examFormats,
        }
      }),

      // Step 2: Per-topic semantic search for deep source grounding (optional)
      {
        id: 'searchDocuments',
        name: 'Searching your study materials',
        optional: true,
        shouldRun: () => config.sourcesEnabled,
        async execute(_input: unknown, ctx: WorkflowContext): Promise<string> {
          const context = ctx.results['gatherContext']?.data as GatherContextResult | undefined

          // Determine search queries — one per topic for targeted results
          let queries: string[] = []
          if (config.selectedTopics?.length) {
            queries = config.selectedTopics.map(t => t)
          } else if (config.customFocus) {
            queries = [config.customFocus]
          } else if (config.focusSubject) {
            queries = [config.focusSubject]
          } else {
            // Use top 5 weak topic names as queries
            const weakNames: string[] = []
            try {
              const parsed = JSON.parse(context?.weakTopics ?? '[]') as Array<{ name: string }>
              weakNames.push(...parsed.map(t => t.name).filter(Boolean).slice(0, 5))
            } catch {
              // weakTopics not valid JSON — fall through to topicsList
            }
            queries = weakNames.length > 0 ? weakNames : (context?.topicsList?.split(', ').slice(0, 5) ?? [])
          }

          if (queries.length === 0) return ''

          // Run parallel semantic searches — topN=15 per query for rich coverage
          type SearchChunk = Awaited<ReturnType<typeof hybridSearch>>[number] & { query: string }
          const searchResults = await Promise.all(
            queries.map(query =>
              hybridSearch(ctx.examProfileId, query, ctx.authToken, { topN: 15, rerank: true })
                .then(chunks => chunks.map(c => ({ ...c, query })))
                .catch((err): SearchChunk[] => {
                  Sentry.captureException(err instanceof Error ? err : new Error(`[practiceExam] semantic search failed for "${query}": ` + String(err)))
                  return []
                })
            )
          )

          // Deduplicate by chunk ID — chunks appearing in multiple searches rank higher
          const chunkScores = new Map<string, { chunk: typeof searchResults[0][0]; totalScore: number; queries: string[] }>()
          for (const results of searchResults) {
            for (const chunk of results) {
              const existing = chunkScores.get(chunk.id)
              if (existing) {
                existing.totalScore += chunk.score
                if (!existing.queries.includes(chunk.query)) {
                  existing.queries.push(chunk.query)
                }
              } else {
                chunkScores.set(chunk.id, {
                  chunk,
                  totalScore: chunk.score,
                  queries: [chunk.query],
                })
              }
            }
          }

          // Sort by total score (multi-query matches rank highest)
          const ranked = Array.from(chunkScores.values())
            .sort((a, b) => b.totalScore - a.totalScore)

          // Format with source labels, cap at budget
          let totalChars = 0
          const parts: string[] = []
          for (const entry of ranked) {
            const docTitle = entry.chunk.documentTitle ?? 'Source'
            const topicLabel = entry.queries.join(', ')
            const formatted = `[Source: "${docTitle}" | Topic: ${topicLabel}]\n${entry.chunk.content}`
            if (totalChars + formatted.length > SOURCE_CONTENT_BUDGET) break
            parts.push(formatted)
            totalChars += formatted.length
          }

          return parts.join('\n\n---\n\n')
        },
      },

      // Step 3: Search web for reference material (optional)
      {
        ...webSearchStep('searchWeb', 'Researching online resources', (ctx) => {
          const context = ctx.results['gatherContext']?.data as GatherContextResult | undefined
          const profileName = context?.profileName ?? ''
          const focusParts = [
            config.customFocus,
            config.focusSubject,
            ...(config.selectedTopics?.slice(0, 3) ?? []),
          ].filter(Boolean).join(' ')
          const focus = focusParts || context?.topicsList?.slice(0, 100) || ''
          return `${profileName} ${focus} exam practice questions`
        }),
        optional: true,
      },

      // Step 4: Generate questions (core LLM step — handles both practice and simulation modes)
      {
        id: 'generateQuestions',
        name: 'Generating exam questions',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<{ questions: GeneratedQuestionData[] }> {
          const context = ctx.results['gatherContext']?.data as GatherContextResult
          const sourceSearchContent = ctx.results['searchDocuments']?.data as string | undefined
          const webContent = ctx.results['searchWeb']?.data as string | undefined

          // Shared helpers for building prompts
          const buildSourceBlock = (): { sourceBlock: string; hasSourceContent: boolean } => {
            const hasSourceContent = config.sourcesEnabled && !!(context?.documentSummaries || sourceSearchContent)
            let sourceBlock = ''
            if (hasSourceContent) {
              if (context?.documentSummaries) sourceBlock += `\n\nSTUDY MATERIAL OVERVIEW:\n${context.documentSummaries}`
              if (sourceSearchContent) sourceBlock += `\n\nDETAILED SOURCE CONTENT (by topic):\n${sourceSearchContent}`
              if (webContent) sourceBlock += `\n\nSUPPLEMENTARY WEB RESEARCH:\n${webContent.slice(0, 3000)}`
            } else if (webContent) {
              sourceBlock += `\n\nWEB RESEARCH:\n${webContent.slice(0, 3000)}`
            }
            return { sourceBlock, hasSourceContent }
          }

          const { sourceBlock, hasSourceContent } = buildSourceBlock()
          const sourceInstructions = hasSourceContent
            ? `- Base at least 80% of questions directly on the provided source content
- In each question's explanation, reference the source document by name
- Do NOT invent facts not in the provided materials — generate fewer questions rather than fabricating
- Include a "sourceReference" field with the document title or section for each question`
            : ''
          const sourceRefField = hasSourceContent ? `\n      "sourceReference": "Document title or section",` : ''

          const systemPrompt = 'You are an expert exam question generator specializing in creating academically rigorous, contextually relevant practice exams. You MUST base all questions on the student\'s actual subjects and study materials. NEVER generate generic or off-topic questions. Return ONLY valid JSON. Never use emojis in questions or explanations.'

          // ─── SIMULATION MODE: generate per-section ───
          if (config.simulationMode && config.sections?.length) {
            const allQuestions: GeneratedQuestionData[] = []
            const sections = config.sections
            let globalQuestionIndex = 0

            for (let sIdx = 0; sIdx < sections.length; sIdx++) {
              const section = sections[sIdx]
              const sectionCount = section.questionCount || 10

              await ctx.updateProgress?.(`Generating ${section.formatName} (${sIdx + 1}/${sections.length})...`)

              // Oral sections: enforce short-answer/essay format only
              const isOral = section.sectionType === 'oral'
              const formatInstruction = isOral
                ? '- Use ONLY "short-answer" or "essay" format for all questions (this is an oral exam section — no multiple choice)'
                : section.questionFormat
                  ? `- Use "${section.questionFormat}" format for all questions in this section`
                  : '- Use a mix of question formats (multiple-choice, true-false, short-answer)'

              const sectionPrompt = `You are generating questions for section "${section.formatName}" of a simulation exam for: "${context.profileName}" (${context.examType}).
${context.examDate ? `Exam date: ${context.examDate}.` : ''}
Passing threshold: ${context.passingThreshold}%.

SECTION DETAILS:
- Section name: ${section.formatName}
- Section type: ${section.sectionType}
- Time allocation: ${section.timeAllocationMinutes} minutes
- Point weight: ${section.pointWeight}%
${section.samplePrompt ? `- Example prompt: ${section.samplePrompt}` : ''}

SUBJECTS AND TOPICS THE STUDENT IS STUDYING:
${context.subjectsList || 'No subjects defined yet.'}

STUDENT PERFORMANCE DATA:
Knowledge graph: ${context.knowledgeGraph}
Weak topics: ${context.weakTopics}
Error patterns: ${context.errorPatterns}
${context.studentModel ? `Learning style: ${context.studentModel.learningStyle}\nCommon mistakes: ${context.studentModel.commonMistakes}` : ''}
${sourceBlock}

CRITICAL INSTRUCTIONS:
- Generate EXACTLY ${sectionCount} questions for this section
- Every question MUST be directly relevant to the subjects and topics listed above
- Questions must be at the appropriate academic level for "${context.profileName}"
- topicName for each question MUST be one of these topics: ${context.topicsList || 'use the subject names'}
- Do NOT generate generic or unrelated questions
- Vary difficulty (1-5) across questions, with more questions at difficulty 2-4
${formatInstruction}
${sourceInstructions}

Respond with ONLY a JSON object in this exact format:
{
  "questions": [
    {
      "text": "Question text here",
      "format": "${isOral ? 'short-answer' : 'multiple-choice'}",
      ${isOral ? '' : '"options": ["Option A", "Option B", "Option C", "Option D"],'}
      "correctAnswer": "${isOral ? 'Expected answer content' : 'Option B'}",
      ${isOral ? '' : '"correctOptionIndex": 1,'}
      "explanation": "Why this is correct...",
      "difficulty": 3,
      "topicName": "Topic Name",${sourceRefField}
      "points": 2
    }
  ]
}

Format rules:
- multiple-choice: 4 options, correctOptionIndex (0-based), correctAnswer matches option text
- true-false: correctAnswer is "true" or "false", no options
- short-answer: correctAnswer is the expected answer, no options
- essay: correctAnswer describes the ideal answer, no options
- Points: 1 for true-false, 2 for MCQ/short-answer, 3 for essay`

              const text = await llmHighTokens(sectionPrompt, systemPrompt, ctx)
              let parsed: { questions: GeneratedQuestionData[] }
              try {
                // Try to parse JSON from response
                const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
                parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { questions: [] }
              } catch {
                parsed = { questions: [] }
              }

              // Tag each question with section metadata
              for (const q of (parsed.questions ?? [])) {
                ;(q as GeneratedQuestionData & { examSectionId?: string; sectionIndex?: number }).examSectionId = section.examFormatId
                ;(q as GeneratedQuestionData & { sectionIndex?: number }).sectionIndex = sIdx
                globalQuestionIndex++
                allQuestions.push(q)
              }
            }

            return { questions: allQuestions }
          }

          // ─── PRACTICE MODE: existing flat batch generation ───
          const focusParts: string[] = []
          if (config.customFocus) {
            focusParts.push(`The student specifically requested questions about: "${config.customFocus}". This is the PRIMARY focus — most questions should target this area.`)
          }
          if (config.selectedTopics?.length) {
            focusParts.push(`Focus on these specific topics: ${config.selectedTopics.join(', ')}.`)
          }
          if (config.focusSubject) {
            focusParts.push(`Focus on the subject: "${config.focusSubject}".`)
          }
          const focusNote = focusParts.length > 0
            ? focusParts.join('\n')
            : 'Cover a mix of subjects, weighted toward the student\'s weakest topics.'

          const sectionNote = config.examSection
            ? `Use the "${config.examSection}" exam format style for all questions.`
            : 'Use a mix of question formats (multiple-choice, true-false, short-answer).'

          const examFormatInfo = context?.examFormats?.length
            ? `\nExam format sections:\n${context.examFormats.map(f => `- ${f.formatName}: ${f.description}${f.samplePrompt ? ` (Example: ${f.samplePrompt})` : ''}`).join('\n')}`
            : ''

          const prompt = `You are generating a practice exam for a student studying for: "${context.profileName}" (${context.examType}).
${context.examDate ? `Exam date: ${context.examDate}.` : ''}
Passing threshold: ${context.passingThreshold}%.

SUBJECTS AND TOPICS THE STUDENT IS STUDYING:
${context.subjectsList || 'No subjects defined yet.'}

${focusNote}
${sectionNote}
${examFormatInfo}

STUDENT PERFORMANCE DATA:
Knowledge graph: ${context.knowledgeGraph}
Weak topics: ${context.weakTopics}
Error patterns: ${context.errorPatterns}
${context.studentModel ? `Learning style: ${context.studentModel.learningStyle}\nCommon mistakes: ${context.studentModel.commonMistakes}` : ''}
${sourceBlock}

CRITICAL INSTRUCTIONS:
- Generate EXACTLY ${config.questionCount} questions
- Every question MUST be directly relevant to the subjects and topics listed above
- Questions must be at the appropriate academic level for "${context.profileName}"
- topicName for each question MUST be one of these topics: ${context.topicsList || 'use the subject names'}
- Do NOT generate generic or unrelated questions
- Vary difficulty (1-5) across questions, with more questions at difficulty 2-4
- Prefer multiple-choice format (at least 60% of questions)
${sourceInstructions}

Respond with ONLY a JSON object in this exact format:
{
  "questions": [
    {
      "text": "Question text here",
      "format": "multiple-choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      "correctOptionIndex": 1,
      "explanation": "Why this is correct...",
      "difficulty": 3,
      "topicName": "Topic Name",${sourceRefField}
      "points": 2
    }
  ]
}

Format rules:
- multiple-choice: 4 options, correctOptionIndex (0-based), correctAnswer matches option text
- true-false: correctAnswer is "true" or "false", no options
- short-answer: correctAnswer is the expected answer, no options
- essay: correctAnswer describes the ideal answer, no options
- Points: 1 for true-false, 2 for MCQ/short-answer, 3 for essay`

          const text = await llmHighTokens(prompt, systemPrompt, ctx)
          const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
          if (!jsonMatch) throw new Error('No JSON found in LLM response')
          return JSON.parse(jsonMatch[0]) as { questions: GeneratedQuestionData[] }
        },
      },

      // Step 5: Validate generated questions (optional)
      {
        ...llmJsonStep<{ questions: GeneratedQuestionData[] }>(
          'validateQuestions',
          'Validating question quality',
          (ctx) => {
            const context = ctx.results['gatherContext']?.data as GatherContextResult
            const generated = ctx.results['generateQuestions']?.data as { questions: GeneratedQuestionData[] }
            return `Review these practice exam questions for "${context.profileName}".

Verify:
1. Every question is relevant to the student's subjects: ${context.topicsList}
2. Correct answers are actually correct
3. MCQ options are plausible distractors
4. No ambiguous wording
5. topicName matches an actual topic

Fix any issues. Remove and replace any question that is off-topic or too generic.

Questions to validate:
${JSON.stringify(generated?.questions ?? [], null, 2)}

Return ONLY a JSON object: { "questions": [...] }
If all questions are correct, return them unchanged.`
          },
          'You are an expert exam reviewer. Ensure every question is relevant to the student\'s actual study profile. Return ONLY valid JSON. Never use emojis.',
        ),
        optional: true,
      },
    ],

    async aggregate(ctx: WorkflowContext): Promise<GeneratedQuestion[]> {
      // Use validated questions if available, otherwise use generated
      const validated = ctx.results['validateQuestions']?.data as { questions: GeneratedQuestionData[] } | undefined
      const generated = ctx.results['generateQuestions']?.data as { questions: GeneratedQuestionData[] }
      const questions = validated?.questions ?? generated?.questions ?? []

      if (questions.length === 0) {
        throw new Error('No questions were generated. Please try again.')
      }

      // Write to IndexedDB
      const generatedQuestions: GeneratedQuestion[] = questions.map((q, i) => ({
        id: crypto.randomUUID(),
        sessionId: config.sessionId,
        examProfileId: ctx.examProfileId,
        questionIndex: i,
        text: q.text,
        format: q.format,
        options: q.options ? JSON.stringify(q.options) : undefined,
        correctAnswer: q.correctAnswer,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topicName: q.topicName,
        points: q.points,
        scenarioText: q.scenarioText,
        subQuestions: q.subQuestions ? JSON.stringify(q.subQuestions) : undefined,
        sourceReference: q.sourceReference,
        isAnswered: false,
        // Simulation mode fields (carried from per-section tagging)
        examSectionId: (q as GeneratedQuestionData & { examSectionId?: string }).examSectionId,
        sectionIndex: (q as GeneratedQuestionData & { sectionIndex?: number }).sectionIndex,
      }))

      await db.generatedQuestions.bulkPut(generatedQuestions)
      await db.practiceExamSessions.update(config.sessionId, { phase: 'ready' })

      return generatedQuestions
    },
  }
}
