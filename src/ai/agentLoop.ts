/**
 * Core agent loop: send messages → parse response → if tool_use: execute locally,
 * feed result back, loop → if text: done. Max 10 iterations. 120s timeout.
 */
import { streamChat } from './client'
import { agentTools } from './toolDefinitions'
import type { Message, ContentBlock, ToolResultBlock } from './types'
import {
  getKnowledgeGraph,
  getWeakTopicsTool,
  getReadinessScore,
  getStudyStats,
  getDueFlashcards,
  getUpcomingDeadlines,
  getFlashcardPerformance,
} from './tools/knowledgeState'
import {
  logQuestionResult,
  updateTopicConfidence,
  createFlashcardDeck,
  addAssignment,
  getStudyRecommendation,
} from './tools/dataOperations'
import {
  searchSourcesTool,
  getDocumentContentTool,
  listSourcesTool,
} from './tools/sourceTools'
import { getCalibrationData } from './tools/calibrationTools'
import { getErrorPatterns } from './tools/knowledgeState'
import { generateStudyPlanTool, getStudyPlanTool, adjustStudyPlanTool } from './tools/planTools'
import {
  getStudentModel,
  updateStudentModel,
  getConversationHistory,
  getRecentSessions,
} from './tools/memoryTools'
import { getTopicDependencies, setTopicPrerequisites } from './tools/dependencyTools'
import { autoMapSourceToTopics } from './tools/conceptTools'
import { startQuickReview, rateFlashcard } from './tools/dataOperations'
import { createMockExam, gradeMockExam } from './tools/examTools'
import {
  getResearchThreads,
  updateThreadStatus,
  getMilestones,
  updateMilestoneStatus,
  synthesizeLiterature,
  generateMeetingPrep,
  searchNotes,
  findNoteConnections,
} from './tools/researchTools'
import {
  searchReviewArticles,
  getArticleComparison,
  getReviewProjectSummary,
} from './tools/reviewTools'
import { saveConceptCard, prepareQuiz, prepareCodePlayground } from './tools/conceptCardTools'
import { db } from '../db'

const MAX_ITERATIONS = 10
const TIMEOUT_MS = 120000
const MAX_TOOL_RESULT_CHARS = 50000 // Truncate oversized tool results to prevent payload bloat

interface AgentLoopOptions {
  messages: Message[]
  systemPrompt: string
  examProfileId: string
  authToken?: string
  getToken?: () => Promise<string | null>
  onToken?: (text: string) => void
  onToolCall?: (toolName: string) => void
  onMessagesUpdate?: (messages: Message[]) => void
  signal?: AbortSignal
  /** Override the chat API URL (e.g., /api/legal-chat for Claude) */
  chatUrl?: string
}

interface AgentLoopResult {
  messages: Message[]
  finalText: string
}

async function executeToolLocally(
  toolName: string,
  input: Record<string, unknown>,
  examProfileId: string,
  authToken?: string,
  signal?: AbortSignal,
): Promise<string> {
  switch (toolName) {
    case 'getKnowledgeGraph':
      return getKnowledgeGraph(examProfileId)
    case 'getWeakTopics':
      return getWeakTopicsTool(examProfileId, (input.limit as number) ?? 10)
    case 'getReadinessScore':
      return getReadinessScore(examProfileId)
    case 'getStudyStats':
      return getStudyStats(examProfileId)
    case 'getDueFlashcards':
      return getDueFlashcards(examProfileId, input.topicId as string | undefined)
    case 'getUpcomingDeadlines':
      return getUpcomingDeadlines(examProfileId, (input.days as number) ?? 7)
    case 'getFlashcardPerformance':
      return getFlashcardPerformance(examProfileId)
    case 'logQuestionResult':
      return logQuestionResult(examProfileId, input as Parameters<typeof logQuestionResult>[1])
    case 'updateTopicConfidence':
      return updateTopicConfidence(examProfileId, input.topicName as string, input.confidence as number)
    case 'createFlashcardDeck':
      return createFlashcardDeck(examProfileId, input as Parameters<typeof createFlashcardDeck>[1])
    case 'addAssignment':
      return addAssignment(examProfileId, input as Parameters<typeof addAssignment>[1])
    case 'getStudyRecommendation':
      return getStudyRecommendation(examProfileId)
    case 'generateQuestions':
      // This is a "meta" tool — returns context so the AI can generate questions
      return JSON.stringify({
        instruction: `Generate ${(input.count as number) ?? 3} practice questions about "${input.topicName}" at difficulty ${(input.difficulty as number) ?? 3}/5 in ${(input.format as string) ?? 'multiple-choice'} format. Include correct answers and explanations.`,
      })
    case 'generateFlashcards':
      return JSON.stringify({
        instruction: `Generate ${(input.count as number) ?? 5} flashcards about "${input.topicName}". Return them as a JSON array of {front, back} objects that I will save using createFlashcardDeck.`,
      })
    case 'searchSources':
      return searchSourcesTool(examProfileId, input.query as string, (input.topN as number) ?? 5)
    case 'getDocumentContent':
      return getDocumentContentTool(examProfileId, input.documentId as string)
    case 'listSources':
      return listSourcesTool(examProfileId)
    case 'searchWeb': {
      if (!authToken) return JSON.stringify({ error: 'Authentication required for web search' })
      const { searchWeb } = await import('./tools/webSearchTool')
      return searchWeb(input.query as string, authToken, (input.maxResults as number) ?? 5)
    }
    case 'searchLegalCodes': {
      if (!authToken) return JSON.stringify({ error: 'Authentication required for legal search' })
      const { searchLegalCodes } = await import('./tools/legalSearchTool')
      return searchLegalCodes(input.query as string, authToken, { topK: input.topK as number, codeName: input.codeName as string })
    }
    case 'getCalibrationData':
      return getCalibrationData(examProfileId, (input.threshold as number) ?? 0.2)
    case 'getErrorPatterns':
      return getErrorPatterns(examProfileId, input.topicName as string | undefined)
    case 'generateStudyPlan':
      if (!authToken) return JSON.stringify({ error: 'Authentication required to generate study plan' })
      return generateStudyPlanTool(examProfileId, authToken, (input.daysAhead as number) ?? 7, signal)
    case 'getStudyPlan':
      return getStudyPlanTool(examProfileId)
    case 'getStudentModel':
      return getStudentModel(examProfileId)
    case 'updateStudentModel':
      return updateStudentModel(examProfileId, input as Parameters<typeof updateStudentModel>[1])
    case 'getConversationHistory':
      return getConversationHistory(examProfileId, input as { keyword?: string; topicName?: string })
    case 'getRecentSessions':
      return getRecentSessions(examProfileId, input as { limit?: number })
    case 'getTopicDependencies':
      return getTopicDependencies(examProfileId, input as { topicName: string })
    case 'setTopicPrerequisites':
      return setTopicPrerequisites(examProfileId, input as { topicName: string; prerequisiteNames: string[] })
    case 'adjustStudyPlan':
      if (!authToken) return JSON.stringify({ error: 'Authentication required' })
      return adjustStudyPlanTool(examProfileId, authToken, (input.reason as string) ?? '', signal)
    case 'autoMapSourceToTopics':
      if (!authToken) return JSON.stringify({ error: 'Authentication required' })
      return autoMapSourceToTopics(examProfileId, input as { documentId: string }, authToken, signal)
    case 'startQuickReview':
      return startQuickReview(examProfileId, input as { topicName?: string; limit?: number })
    case 'rateFlashcard':
      return rateFlashcard(examProfileId, input as { cardId: string; rating: number })
    case 'createMockExam':
      return createMockExam(examProfileId, input as { timeLimitMinutes: number; formatIds?: string[] })
    case 'gradeMockExam':
      if (!authToken) return JSON.stringify({ error: 'Authentication required' })
      return gradeMockExam(examProfileId, input as { examId: string }, authToken, signal)
    case 'getResearchThreads':
      return getResearchThreads(examProfileId)
    case 'updateThreadStatus':
      return updateThreadStatus(examProfileId, input as { topicName: string; status: string })
    case 'getMilestones':
      return getMilestones(examProfileId)
    case 'updateMilestone':
      return updateMilestoneStatus(examProfileId, input as { milestoneId: string; status: string })
    case 'synthesizeLiterature':
      return synthesizeLiterature(examProfileId, input as { documentIds?: string[] })
    case 'generateMeetingPrep':
      return generateMeetingPrep(examProfileId)
    case 'searchNotes':
      return searchNotes(examProfileId, input as { query: string })
    case 'findNoteConnections':
      return findNoteConnections(examProfileId, input as { noteId: string })
    case 'searchReviewArticles':
      return searchReviewArticles(examProfileId, input as { query: string; projectId?: string }, authToken)
    case 'getArticleComparison':
      return getArticleComparison(examProfileId, input as { articleIds: string[] })
    case 'getReviewProjectSummary':
      return getReviewProjectSummary(examProfileId, input as { projectId: string })
    case 'renderConceptCard': {
      // Find the session topic from the current conversation context
      const topicName = (input.title as string) ?? ''
      const topic = await db.topics.where('examProfileId').equals(examProfileId).filter(t => t.name.toLowerCase().includes(topicName.toLowerCase().split(' ')[0])).first()
      const topicId = topic?.id ?? ''
      return saveConceptCard(examProfileId, topicId, input as unknown as Parameters<typeof saveConceptCard>[2])
    }
    case 'renderQuiz':
      return prepareQuiz(input as unknown as Parameters<typeof prepareQuiz>[0])
    case 'renderCodePlayground':
      return prepareCodePlayground(input as unknown as Parameters<typeof prepareCodePlayground>[0])
    case 'executeSequence': {
      const steps = (input.steps ?? []) as Array<{ toolName: string; input: Record<string, unknown> }>
      const results: Array<{ toolName: string; result: string }> = []
      for (const step of steps.slice(0, 5)) {
        if (step.toolName === 'executeSequence') continue // prevent nesting
        const result = await executeToolLocally(step.toolName, step.input ?? {}, examProfileId, authToken, signal)
        results.push({ toolName: step.toolName, result: result.slice(0, 3000) })
      }
      return JSON.stringify({ sequenceCompleted: true, stepCount: results.length, results })
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const { systemPrompt, examProfileId, authToken, getToken, onToken, onToolCall, signal, chatUrl } = options
  const messages = [...options.messages]
  let finalText = ''
  // Collect markers from tool results (quiz, card, code) to inject if the AI doesn't include them
  const pendingMarkers: string[] = []

  const startTime = Date.now()

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Abort check
    if (signal?.aborted) break

    // Timeout check
    if (Date.now() - startTime > TIMEOUT_MS) {
      finalText += '\n\n[Agent timed out after 120 seconds]'
      break
    }

    const response = await streamChat({
      messages,
      system: systemPrompt,
      tools: agentTools,
      authToken,
      getToken,
      onToken,
      onToolCall,
      signal,
      url: chatUrl,
    })

    // Check for tool use
    const toolUses = response.content.filter(
      (c): c is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        c.type === 'tool_use'
    )
    const textBlocks = response.content.filter(
      (c): c is { type: 'text'; text: string } => c.type === 'text'
    )

    if (toolUses.length > 0) {
      // Build assistant message with content blocks
      const assistantContent: ContentBlock[] = []
      for (const block of response.content) {
        if (block.type === 'text') {
          assistantContent.push({ type: 'text', text: block.text })
        } else if (block.type === 'tool_use') {
          assistantContent.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          })
        }
      }
      const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: assistantContent }
      if (response.reasoningContent) assistantMsg.reasoning_content = response.reasoningContent
      messages.push(assistantMsg)

      // Execute tools in parallel and add results (truncate oversized results to keep payload manageable)
      const resultBlocks: ContentBlock[] = await Promise.all(
        toolUses.map(async (toolUse) => {
          onToolCall?.(toolUse.name)
          try {
            let result = await executeToolLocally(toolUse.name, toolUse.input, examProfileId, authToken, signal)
            // Extract marker BEFORE truncation so markers in large results aren't lost
            try {
              const parsed = JSON.parse(result)
              if (parsed.marker) pendingMarkers.push(parsed.marker)
            } catch { /* not JSON or no marker — fine */ }
            if (result.length > MAX_TOOL_RESULT_CHARS) {
              result = result.slice(0, MAX_TOOL_RESULT_CHARS) + '\n...[truncated]'
            }
            return {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: result,
            } as ToolResultBlock
          } catch (err) {
            return {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' }),
              is_error: true,
            } as ToolResultBlock
          }
        })
      )
      if (signal?.aborted) break
      messages.push({ id: crypto.randomUUID(), role: 'user', content: resultBlocks })
      options.onMessagesUpdate?.([...messages])

      continue // Loop back
    }

    // No tool calls — we have a final text response
    let text = textBlocks.map(b => b.text).join('')

    // Auto-inject markers the AI forgot to include (quiz, card, code blocks)
    for (const marker of pendingMarkers) {
      if (!text.includes(marker)) {
        text = marker + '\n' + text
      }
    }
    pendingMarkers.length = 0

    finalText += text
    messages.push({ id: crypto.randomUUID(), role: 'assistant', content: text })
    break
  }

  return { messages, finalText }
}

