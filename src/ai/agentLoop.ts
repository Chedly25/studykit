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

const MAX_ITERATIONS = 10
const TIMEOUT_MS = 120000
const MAX_TOOL_RESULT_CHARS = 15000 // Truncate oversized tool results to prevent payload bloat

interface AgentLoopOptions {
  messages: Message[]
  systemPrompt: string
  examProfileId: string
  authToken?: string
  onToken?: (text: string) => void
  onToolCall?: (toolName: string) => void
  onMessagesUpdate?: (messages: Message[]) => void
  signal?: AbortSignal
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
      return getDueFlashcards(input.topicId as string | undefined)
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
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const { systemPrompt, examProfileId, authToken, onToken, onToolCall, signal } = options
  const messages = [...options.messages]
  let finalText = ''

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
      onToken,
      onToolCall,
      signal,
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
      const assistantMsg: Message = { role: 'assistant', content: assistantContent }
      if (response.reasoningContent) assistantMsg.reasoning_content = response.reasoningContent
      messages.push(assistantMsg)

      // Execute tools and add results (truncate oversized results to keep payload manageable)
      const resultBlocks: ContentBlock[] = []
      for (const toolUse of toolUses) {
        onToolCall?.(toolUse.name)
        try {
          let result = await executeToolLocally(toolUse.name, toolUse.input, examProfileId, authToken, signal)
          if (result.length > MAX_TOOL_RESULT_CHARS) {
            result = result.slice(0, MAX_TOOL_RESULT_CHARS) + '\n...[truncated]'
          }
          resultBlocks.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result,
          } as ToolResultBlock)
        } catch (err) {
          if (signal?.aborted) break
          resultBlocks.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' }),
            is_error: true,
          } as ToolResultBlock)
        }
      }
      if (signal?.aborted) break
      messages.push({ role: 'user', content: resultBlocks })
      options.onMessagesUpdate?.([...messages])

      continue // Loop back
    }

    // No tool calls — we have a final text response
    const text = textBlocks.map(b => b.text).join('')
    finalText += text
    messages.push({ role: 'assistant', content: text })
    break
  }

  return { messages, finalText }
}

