/**
 * Exam simulation generation workflow — multi-agent pipeline:
 * 1. Gather context (DB)
 * 2. Search documents (optional)
 * 3. Exam Architect — designs coherent blueprint with question slots
 * 4. Section Writers — generates questions per-section following blueprint
 * 5. Coherence Reviewer — validates and rewrites the full exam
 * 6. Answer Key Builder — creates detailed marking schemes per section
 *
 * This replaces the flat per-section generation used in practice-exam-generation
 * when simulationMode is enabled.
 */
import { db } from '../../db'
import type { GeneratedQuestion } from '../../db/schema'
import { dbQueryStep } from '../orchestrator/steps'
import type { WorkflowDefinition, WorkflowContext } from '../orchestrator/types'
import { getKnowledgeGraph, getWeakTopicsTool, getErrorPatterns } from '../tools/knowledgeState'
import { hybridSearch } from '../../lib/hybridSearch'
import { streamChat } from '../client'
import type { SimulationSection } from './practiceExam'

/**
 * Call the main LLM model with high token limits for exam generation.
 * Bypasses ctx.llm() which uses the fast model with 4096 tokens — too small for exams.
 */
async function llmMain(prompt: string, system: string, ctx: WorkflowContext, maxTokens = 16384): Promise<string> {
  const response = await streamChat({
    messages: [{ id: crypto.randomUUID(), role: 'user', content: prompt }],
    system,
    tools: [],
    maxTokens,
    authToken: ctx.authToken,
    signal: ctx.signal,
  })
  return response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('')
}

// ─── Config ─────────────────────────────────────────────────────

export interface ExamSimulationConfig {
  sessionId: string
  sourcesEnabled: boolean
  sections: SimulationSection[]
}

// ─── Types ──────────────────────────────────────────────────────

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
  recentExamThemes: string[]
}

interface ExamBlueprint {
  examTheme: string
  sections: Array<{
    sectionId: string
    sectionName: string
    theme: string
    questionSlots: Array<{
      slotIndex: number
      topic: string
      concept: string
      cognitiveLevel: string
      targetDifficulty: number
      format: string
      dependsOn?: { sectionIndex: number; slotIndex: number }
      commonMistakeToTest?: string
      notes?: string
    }>
    difficultyArc: string
    estimatedMinutes: number
  }>
  crossSectionNotes: string
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
  // Tagged during generation
  examSectionId?: string
  sectionIndex?: number
}

interface AnswerKey {
  sectionIndex: number
  questionIndex: number
  correctAnswer: string
  explanation: string
  markingScheme: {
    fullMarks: number
    criteria: Array<{ criterion: string; points: number }>
    commonErrors: Array<{ error: string; deduction: number }>
  }
  distractorExplanations?: Record<string, string>
}

// ─── Helpers ────────────────────────────────────────────────────

const SOURCE_CONTENT_BUDGET = 80_000

const SYSTEM_PROMPT = 'You are an expert exam architect and question writer. You create academically rigorous, coherent exams where questions build on each other and test deep understanding. Return ONLY valid JSON. Never use emojis.'

function parseJsonFromLlm<T>(text: string): T {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in LLM response')
  return JSON.parse(jsonMatch[0]) as T
}

// ─── Workflow Factory ───────────────────────────────────────────

export function createExamSimulationWorkflow(config: ExamSimulationConfig): WorkflowDefinition<GeneratedQuestion[]> {
  return {
    id: 'exam-simulation',
    name: 'Generate Exam Simulation',
    steps: [
      // ── Step 1: Gather context ──────────────────────────────
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

        const subjectsList = subjects.map(s => {
          const subTopics = topics.filter(t => t.subjectId === s.id)
          const topicNames = subTopics.map(t => `    - ${t.name} (mastery: ${Math.round(t.mastery * 100)}%, ${t.questionsAttempted} attempted)`).join('\n')
          return `  ${s.name} (weight: ${s.weight}%, mastery: ${Math.round(s.mastery * 100)}%)\n${topicNames}`
        }).join('\n')

        const topicsList = topics.map(t => t.name).join(', ')

        let documentSummaries = ''
        const documentIds: string[] = []
        for (const doc of documents) {
          documentIds.push(doc.id)
          documentSummaries += `- ${doc.title}: ${doc.summary || '(no summary)'}\n`
        }

        // Load recent exam themes to avoid repetition
        const pastSims = await db.practiceExamSessions
          .where('examProfileId').equals(ctx.examProfileId)
          .filter(s => !!s.simulationMode && !!s.examBlueprint)
          .toArray()
        const recentExamThemes = pastSims
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
          .slice(0, 3)
          .map(s => {
            try { return JSON.parse(s.examBlueprint!).examTheme as string } catch { return '' }
          })
          .filter(Boolean)

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
          examFormats: examFormats.map(f => ({ formatName: f.formatName, description: f.description, samplePrompt: f.samplePrompt })),
          recentExamThemes,
        }
      }),

      // ── Step 2: Search documents (optional) ─────────────────
      {
        id: 'searchDocuments',
        name: 'Searching your study materials',
        optional: true,
        shouldRun: () => config.sourcesEnabled,
        async execute(_input: unknown, ctx: WorkflowContext): Promise<string> {
          const context = ctx.results['gatherContext']?.data as GatherContextResult | undefined
          const topicNames = context?.topicsList?.split(', ').slice(0, 8) ?? []
          if (topicNames.length === 0) return ''

          type SearchChunk = Awaited<ReturnType<typeof hybridSearch>>[number] & { query: string }
          const searchResults = await Promise.all(
            topicNames.map(query =>
              hybridSearch(ctx.examProfileId, query, ctx.authToken, { topN: 15, rerank: true })
                .then(chunks => chunks.map(c => ({ ...c, query })))
                .catch((): SearchChunk[] => [])
            )
          )

          const chunkScores = new Map<string, { chunk: SearchChunk; totalScore: number; queries: string[] }>()
          for (const results of searchResults) {
            for (const chunk of results) {
              const existing = chunkScores.get(chunk.id)
              if (existing) {
                existing.totalScore += chunk.score
                if (!existing.queries.includes(chunk.query)) existing.queries.push(chunk.query)
              } else {
                chunkScores.set(chunk.id, { chunk, totalScore: chunk.score, queries: [chunk.query] })
              }
            }
          }

          const ranked = Array.from(chunkScores.values()).sort((a, b) => b.totalScore - a.totalScore)
          let totalChars = 0
          const parts: string[] = []
          for (const entry of ranked) {
            const formatted = `[Source: "${entry.chunk.documentTitle ?? 'Source'}" | Topics: ${entry.queries.join(', ')}]\n${entry.chunk.content}`
            if (totalChars + formatted.length > SOURCE_CONTENT_BUDGET) break
            parts.push(formatted)
            totalChars += formatted.length
          }
          return parts.join('\n\n---\n\n')
        },
      },

      // ── Step 3: Exam Architect ──────────────────────────────
      {
        id: 'examArchitect',
        name: 'Designing exam blueprint',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<ExamBlueprint> {
          const context = ctx.results['gatherContext'].data as GatherContextResult
          const sources = ctx.results['searchDocuments']?.data as string | undefined

          const sectionSpecs = config.sections.map((s, i) => (
            `Section ${i + 1}: "${s.formatName}"
  - Type: ${s.sectionType}
  - Time: ${s.timeAllocationMinutes} minutes
  - Weight: ${s.pointWeight}%
  - Questions: ${s.questionCount}
  - Format: ${s.questionFormat || 'mixed'}
  ${s.samplePrompt ? `- Example: ${s.samplePrompt}` : ''}`
          )).join('\n\n')

          const avoidThemes = context.recentExamThemes.length > 0
            ? `\nAVOID these themes (used in recent exams): ${context.recentExamThemes.join('; ')}`
            : ''

          const prompt = `You are the chief examiner for "${context.profileName}" (${context.examType}).
${context.examDate ? `Exam date: ${context.examDate}.` : ''}
Passing threshold: ${context.passingThreshold}%.

Design an exam BLUEPRINT — not the questions themselves, just the architectural plan that question writers will follow.

EXAM SECTIONS:
${sectionSpecs}

STUDENT'S CURRENT MASTERY:
${context.subjectsList || 'No subjects defined.'}

WEAK AREAS: ${context.weakTopics}
ERROR PATTERNS: ${context.errorPatterns}
${context.studentModel ? `COMMON MISTAKES: ${context.studentModel.commonMistakes}` : ''}
${sources ? `\nAVAILABLE SOURCE MATERIAL SUMMARY:\n${context.documentSummaries}` : ''}
${avoidThemes}

INSTRUCTIONS:
1. Choose a unifying THEME that ties the exam together (e.g., "Applications of thermodynamics in industrial processes")
2. For each section, create a sub-theme and specify EVERY question slot with: topic, specific concept being tested, cognitive level (recall/understand/apply/analyze/create), target difficulty (1-5), question format, and any dependencies on other questions
3. Design a difficulty arc within each section (generally escalating, with warm-up questions first)
4. Create inter-question dependencies where appropriate (e.g., "Q3 uses the result from Q2")
5. Distribute topics across sections to avoid testing the same concept twice
6. Focus more slots on weak topics and topics where the student makes common mistakes

Return ONLY valid JSON:
{
  "examTheme": "Unifying theme for the entire exam",
  "sections": [
    {
      "sectionId": "section-format-id",
      "sectionName": "Section Name",
      "theme": "Section-specific theme",
      "questionSlots": [
        {
          "slotIndex": 0,
          "topic": "Topic Name (must match student's topics)",
          "concept": "Specific concept being tested",
          "cognitiveLevel": "apply",
          "targetDifficulty": 3,
          "format": "multiple-choice",
          "dependsOn": null,
          "commonMistakeToTest": "Optional: specific mistake to probe",
          "notes": "Optional: special instructions for question writer"
        }
      ],
      "difficultyArc": "Start at 2, escalate to 4 by question 6, final question at 5",
      "estimatedMinutes": 60
    }
  ],
  "crossSectionNotes": "Section B should not re-test concepts from Section A. The scenario in Section C can reference Section A's industrial context."
}`

          const text = await llmMain(prompt, SYSTEM_PROMPT, ctx)
          const blueprint = parseJsonFromLlm<ExamBlueprint>(text)

          // Persist blueprint
          await db.practiceExamSessions.update(config.sessionId, {
            examBlueprint: JSON.stringify(blueprint),
          })

          return blueprint
        },
      },

      // ── Step 4: Section Writers ─────────────────────────────
      {
        id: 'sectionWriters',
        name: 'Writing exam sections',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<{ questions: GeneratedQuestionData[] }> {
          const context = ctx.results['gatherContext'].data as GatherContextResult
          const blueprint = ctx.results['examArchitect'].data as ExamBlueprint
          const sources = ctx.results['searchDocuments']?.data as string | undefined

          const allQuestions: GeneratedQuestionData[] = []

          for (let sIdx = 0; sIdx < blueprint.sections.length; sIdx++) {
            const bpSection = blueprint.sections[sIdx]
            const simSection = config.sections[sIdx]
            if (!simSection) continue

            await ctx.updateProgress?.(`Writing ${bpSection.sectionName} (${sIdx + 1}/${blueprint.sections.length})`)

            // Build dependency context from previously generated questions
            const hasDeps = bpSection.questionSlots.some(s => s.dependsOn)
            let depsContext = ''
            if (hasDeps && allQuestions.length > 0) {
              const referencedQuestions = allQuestions.map((q, i) => ({
                sectionIndex: q.sectionIndex,
                questionIndex: i,
                text: q.text.slice(0, 200),
                correctAnswer: q.correctAnswer.slice(0, 100),
              }))
              depsContext = `\nQUESTIONS FROM PREVIOUS SECTIONS (for dependency reference):\n${JSON.stringify(referencedQuestions, null, 2)}`
            }

            const isOral = simSection.sectionType === 'oral'
            const formatRule = isOral
              ? 'Use ONLY "short-answer" or "essay" format (oral section).'
              : simSection.questionFormat
                ? `Use "${simSection.questionFormat}" format for all questions.`
                : 'Use a mix of formats as specified in the blueprint slots.'

            const sectionPrompt = `You are writing section "${bpSection.sectionName}" of a "${context.profileName}" exam.

EXAM THEME: ${blueprint.examTheme}
SECTION THEME: ${bpSection.theme}
DIFFICULTY ARC: ${bpSection.difficultyArc}
TIME: ${simSection.timeAllocationMinutes} minutes | WEIGHT: ${simSection.pointWeight}%

BLUEPRINT — Follow these question slots EXACTLY:
${JSON.stringify(bpSection.questionSlots, null, 2)}

CROSS-SECTION NOTES FROM CHIEF EXAMINER:
${blueprint.crossSectionNotes}
${depsContext}

STUDENT CONTEXT:
${context.subjectsList}
Weak areas: ${context.weakTopics}
${context.studentModel ? `Common mistakes: ${context.studentModel.commonMistakes}` : ''}
${sources ? `\nSOURCE MATERIAL (ground questions in this content):\n${sources.slice(0, 80000)}` : ''}

RULES:
- Generate EXACTLY ${simSection.questionCount} questions following the blueprint slots
- ${formatRule}
- Each question's topicName MUST match one of: ${context.topicsList}
- If a slot says "dependsOn", the question MUST reference/use the specified previous question
- MCQ: 4 options with plausible distractors targeting the common mistakes noted in slots
- The section should feel like a coherent document, not disconnected questions
- Points: 1 for true-false, 2 for MCQ/short-answer, 3-5 for essay/vignette

Return ONLY JSON: { "questions": [{ "text": "...", "format": "...", "options": [...], "correctAnswer": "...", "correctOptionIndex": N, "explanation": "...", "difficulty": N, "topicName": "...", "points": N, "scenarioText": "...", "sourceReference": "..." }] }`

            const text = await llmMain(sectionPrompt, SYSTEM_PROMPT, ctx)
            let parsed: { questions: GeneratedQuestionData[] }
            try {
              parsed = parseJsonFromLlm<{ questions: GeneratedQuestionData[] }>(text)
            } catch {
              parsed = { questions: [] }
            }

            for (const q of (parsed.questions ?? [])) {
              q.examSectionId = simSection.examFormatId
              q.sectionIndex = sIdx
              allQuestions.push(q)
            }
          }

          return { questions: allQuestions }
        },
      },

      // ── Step 5: Coherence Reviewer ──────────────────────────
      {
        id: 'coherenceReview',
        name: 'Reviewing exam coherence',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<{ questions: GeneratedQuestionData[] }> {
          const blueprint = ctx.results['examArchitect'].data as ExamBlueprint
          const generated = ctx.results['sectionWriters'].data as { questions: GeneratedQuestionData[] }

          await ctx.updateProgress?.('Reviewing full exam for coherence and quality...')

          // For very large exams, send a summary to the reviewer
          const questionsForReview = generated.questions.map((q, i) => ({
            index: i,
            sectionIndex: q.sectionIndex,
            text: q.text,
            format: q.format,
            correctAnswer: q.correctAnswer,
            options: q.options,
            difficulty: q.difficulty,
            topicName: q.topicName,
            points: q.points,
            explanation: q.explanation,
          }))

          const prompt = `You are the QUALITY REVIEWER for this "${blueprint.examTheme}" exam. Review the COMPLETE exam and ACTIVELY FIX any issues.

ORIGINAL BLUEPRINT:
${JSON.stringify(blueprint, null, 2)}

GENERATED EXAM (${generated.questions.length} questions total):
${JSON.stringify(questionsForReview, null, 2)}

REVIEW CRITERIA:
1. DUPLICATES — same concept tested twice across different sections? Remove/replace one.
2. DIFFICULTY CURVE — does each section follow the blueprint's difficulty arc? Fix ordering if not.
3. DEPENDENCIES — if Q depends on another Q, is it actually solvable using that Q's answer? Fix the reference.
4. TIME BUDGET — is the work realistic for the allocated time? Flag overloaded sections.
5. TOPIC COVERAGE — does the distribution match the exam format weights? Rebalance if needed.
6. QUESTION QUALITY — clear, unambiguous, at the right cognitive level? Rewrite vague questions.
7. MCQ DISTRACTORS — plausible but clearly wrong? Fix if too obvious or misleading.

ACTIVELY REWRITE any question that fails these checks. Return the COMPLETE question list with all fixes applied inline.

Return ONLY JSON:
{
  "overallScore": 0-100,
  "issues": [
    { "severity": "critical" | "warning" | "suggestion", "sectionIndex": 0, "questionIndex": 0, "issue": "description", "fix": "what was changed" }
  ],
  "revisedQuestions": [
    // COMPLETE list of ALL questions with fixes applied. Keep examSectionId and sectionIndex from originals.
  ]
}`

          const text = await llmMain(prompt, 'You are a meticulous exam quality reviewer. Fix every issue you find. Return ONLY valid JSON. Never use emojis.', ctx)

          try {
            const result = parseJsonFromLlm<{
              overallScore: number
              issues: Array<{ severity: string; sectionIndex: number; questionIndex: number; issue: string; fix?: string }>
              revisedQuestions?: GeneratedQuestionData[]
            }>(text)

            if (result.revisedQuestions && result.revisedQuestions.length > 0) {
              // Carry over section metadata from originals
              for (let i = 0; i < result.revisedQuestions.length; i++) {
                const original = generated.questions[i]
                if (original && !result.revisedQuestions[i].examSectionId) {
                  result.revisedQuestions[i].examSectionId = original.examSectionId
                  result.revisedQuestions[i].sectionIndex = original.sectionIndex
                }
              }
              return { questions: result.revisedQuestions }
            }
          } catch {
            // If parsing fails, return original questions
          }

          return generated
        },
      },

      // ── Step 6: Answer Key Builder (per-section) ────────────
      {
        id: 'answerKeyBuilder',
        name: 'Building answer keys',
        async execute(_input: unknown, ctx: WorkflowContext): Promise<{ answerKeys: AnswerKey[] }> {
          const reviewed = ctx.results['coherenceReview'].data as { questions: GeneratedQuestionData[] }
          const allKeys: AnswerKey[] = []

          // Group questions by section
          const sectionIndices = [...new Set(reviewed.questions.map(q => q.sectionIndex ?? 0))]
          sectionIndices.sort((a, b) => a - b)

          for (let i = 0; i < sectionIndices.length; i++) {
            const sIdx = sectionIndices[i]
            const sectionQuestions = reviewed.questions
              .map((q, qIdx) => ({ ...q, _globalIndex: qIdx }))
              .filter(q => (q.sectionIndex ?? 0) === sIdx)

            if (sectionQuestions.length === 0) continue

            const sectionName = config.sections[sIdx]?.formatName ?? `Section ${sIdx + 1}`
            await ctx.updateProgress?.(`Building answer keys for ${sectionName} (${i + 1}/${sectionIndices.length})`)

            const prompt = `Create the OFFICIAL MARKING SCHEME for these ${sectionQuestions.length} questions from "${sectionName}".

QUESTIONS:
${JSON.stringify(sectionQuestions.map((q, i) => ({
  index: i,
  text: q.text,
  format: q.format,
  options: q.options,
  correctAnswer: q.correctAnswer,
  points: q.points,
  topicName: q.topicName,
})), null, 2)}

For EACH question, provide:
- MCQ/True-False: correct answer + why each distractor is wrong (1 sentence each)
- Short Answer: model answer + key points for full marks + partial credit breakdown
- Essay: rubric with criteria and point allocation + model answer outline + common pitfalls
- Problems: full worked solution + partial credit breakpoints + common errors with deductions

Return ONLY JSON:
{
  "answerKeys": [
    {
      "questionIndex": 0,
      "sectionIndex": ${sIdx},
      "correctAnswer": "...",
      "explanation": "Detailed explanation of the correct answer",
      "markingScheme": {
        "fullMarks": 2,
        "criteria": [
          { "criterion": "What to look for", "points": 1 }
        ],
        "commonErrors": [
          { "error": "Common mistake description", "deduction": 0.5 }
        ]
      },
      "distractorExplanations": { "A": "Why wrong", "B": "Why correct", "C": "Why wrong", "D": "Why wrong" }
    }
  ]
}`

            try {
              const text = await llmMain(prompt, 'You are an expert exam marker creating official marking schemes. Be precise with partial credit breakpoints. Return ONLY valid JSON. Never use emojis.', ctx)
              const parsed = parseJsonFromLlm<{ answerKeys: AnswerKey[] }>(text)

              // Map local questionIndex back to global
              for (const key of (parsed.answerKeys ?? [])) {
                const localQ = sectionQuestions[key.questionIndex]
                if (localQ) {
                  key.questionIndex = localQ._globalIndex
                  key.sectionIndex = sIdx
                }
                allKeys.push(key)
              }
            } catch {
              // Non-fatal — questions will work without marking schemes
            }
          }

          return { answerKeys: allKeys }
        },
      },
    ],

    // ── Aggregate: write to DB ──────────────────────────────────
    async aggregate(ctx: WorkflowContext): Promise<GeneratedQuestion[]> {
      const reviewed = ctx.results['coherenceReview']?.data as { questions: GeneratedQuestionData[] }
      const answerKeyResult = ctx.results['answerKeyBuilder']?.data as { answerKeys: AnswerKey[] } | undefined
      const questions = reviewed?.questions ?? []

      if (questions.length === 0) {
        throw new Error('No questions were generated. Please try again.')
      }

      // Build answer key lookup
      const keyMap = new Map<number, AnswerKey>()
      for (const key of (answerKeyResult?.answerKeys ?? [])) {
        keyMap.set(key.questionIndex, key)
      }

      const generatedQuestions: GeneratedQuestion[] = questions.map((q, i) => {
        const key = keyMap.get(i)
        return {
          id: crypto.randomUUID(),
          sessionId: config.sessionId,
          examProfileId: ctx.examProfileId,
          questionIndex: i,
          text: q.text,
          format: q.format,
          options: q.options ? JSON.stringify(q.options) : undefined,
          correctAnswer: key?.correctAnswer ?? q.correctAnswer,
          correctOptionIndex: q.correctOptionIndex,
          explanation: key?.explanation ?? q.explanation,
          difficulty: q.difficulty,
          topicName: q.topicName ?? '',
          points: q.points,
          scenarioText: q.scenarioText,
          subQuestions: q.subQuestions ? JSON.stringify(q.subQuestions) : undefined,
          sourceReference: q.sourceReference,
          isAnswered: false,
          examSectionId: q.examSectionId,
          sectionIndex: q.sectionIndex,
          markingScheme: key?.markingScheme ? JSON.stringify(key.markingScheme) : undefined,
        }
      })

      await db.generatedQuestions.bulkPut(generatedQuestions)
      await db.practiceExamSessions.update(config.sessionId, { phase: 'ready' })

      return generatedQuestions
    },
  }
}
