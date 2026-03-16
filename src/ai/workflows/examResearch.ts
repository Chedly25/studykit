/**
 * Exam research workflow — runs after profile creation for non-custom types.
 * Steps: web search format → web search scoring → LLM synthesize → save to DB
 */
import { db } from '../../db'
import type { WorkflowDefinition } from '../orchestrator/types'
import { llmJsonStep, webSearchStep, localStep } from '../orchestrator/steps'

interface ExamResearchResult {
  examIntelligence: string
  sectionsCreated: number
}

interface ResearchConfig {
  examProfileId: string
  profileName: string
  examType: string
}

export function createExamResearchWorkflow(
  config: ResearchConfig,
): WorkflowDefinition<ExamResearchResult> {
  return {
    id: 'exam-research',
    name: 'Researching your exam',
    steps: [
      // Step 1: Search for exam format
      webSearchStep(
        'search-format',
        'Searching exam format',
        () => `${config.profileName} exam format structure sections time allocation ${new Date().getFullYear()}`,
      ),

      // Step 2: Search for scoring details
      webSearchStep(
        'search-scoring',
        'Searching scoring criteria',
        () => `${config.profileName} exam scoring rubric passing score grading criteria`,
      ),

      // Step 3: LLM synthesizes research into structured format
      llmJsonStep<{
        examIntelligence: {
          overview: string
          totalDuration: number
          passingScore?: number
          sections: Array<{
            name: string
            description: string
            timeMinutes: number
            pointWeight: number
            questionCount?: number
            samplePrompt?: string
          }>
          tips: string[]
        }
      }>('synthesize', 'Analyzing exam structure', (ctx) => {
        const formatResults = ctx.results['search-format']?.data as string ?? ''
        const scoringResults = ctx.results['search-scoring']?.data as string ?? ''

        return `You are an exam preparation expert. Analyze the following web search results about "${config.profileName}" and produce a structured JSON summary.

Web search results about exam format:
${formatResults.slice(0, 4000)}

Web search results about scoring:
${scoringResults.slice(0, 4000)}

Return JSON with this structure:
{
  "examIntelligence": {
    "overview": "Brief description of the exam (2-3 sentences)",
    "totalDuration": <total exam duration in minutes>,
    "passingScore": <passing score percentage if known, or null>,
    "sections": [
      {
        "name": "Section name",
        "description": "What this section tests",
        "timeMinutes": <time allocation in minutes>,
        "pointWeight": <percentage of total score>,
        "questionCount": <number of questions if known>,
        "samplePrompt": "Example question or task description"
      }
    ],
    "tips": ["Preparation tip 1", "Tip 2", ...]
  }
}

If you cannot find specific details, make reasonable estimates based on the exam type (${config.examType}).
Respond ONLY with valid JSON.`
      }, 'You are an exam research specialist. Analyze search results and produce accurate, structured exam intelligence.'),

      // Step 4: Save to DB
      localStep('save-results', 'Saving exam data', async (ctx) => {
        const synthesized = ctx.results['synthesize']?.data as {
          examIntelligence: {
            overview: string
            totalDuration: number
            passingScore?: number
            sections: Array<{
              name: string
              description: string
              timeMinutes: number
              pointWeight: number
              questionCount?: number
              samplePrompt?: string
            }>
            tips: string[]
          }
        } | undefined

        if (!synthesized?.examIntelligence) {
          return { examIntelligence: '', sectionsCreated: 0 }
        }

        const intel = synthesized.examIntelligence

        // Save exam intelligence JSON to profile
        const intelligenceJson = JSON.stringify(intel)
        await db.examProfiles.update(config.examProfileId, {
          examIntelligence: intelligenceJson,
        } as Record<string, unknown>)

        // Create ExamFormat records for each section
        let sectionsCreated = 0
        if (intel.sections && intel.sections.length > 0) {
          for (const section of intel.sections) {
            await db.examFormats.put({
              id: crypto.randomUUID(),
              examProfileId: config.examProfileId,
              formatName: section.name,
              description: section.description,
              timeAllocation: section.timeMinutes,
              pointWeight: section.pointWeight,
              questionCount: section.questionCount,
              samplePrompt: section.samplePrompt,
            })
            sectionsCreated++
          }
        }

        // Update passing threshold if found
        if (intel.passingScore != null && intel.passingScore > 0) {
          await db.examProfiles.update(config.examProfileId, {
            passingThreshold: intel.passingScore,
          })
        }

        return { examIntelligence: intelligenceJson, sectionsCreated }
      }),
    ],

    aggregate(ctx) {
      const result = ctx.results['save-results']?.data as ExamResearchResult | undefined
      return result ?? { examIntelligence: '', sectionsCreated: 0 }
    },
  }
}
