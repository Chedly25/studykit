/**
 * Core agent loop: send messages → parse response → if tool_use: execute locally,
 * feed result back, loop → if text: done. Max 10 iterations. 60s timeout.
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
import { generateStudyPlanTool, getStudyPlanTool } from './tools/planTools'

const MAX_ITERATIONS = 10
const TIMEOUT_MS = 60000

interface AgentLoopOptions {
  messages: Message[]
  systemPrompt: string
  examProfileId: string
  authToken?: string
  onToken?: (text: string) => void
  onToolCall?: (toolName: string) => void
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
      return generateStudyPlanTool(examProfileId, authToken, (input.daysAhead as number) ?? 7)
    case 'getStudyPlan':
      return getStudyPlanTool(examProfileId)
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
      finalText += '\n\n[Agent timed out after 60 seconds]'
      break
    }

    const response = await streamChat({
      messages,
      system: systemPrompt,
      tools: agentTools,
      authToken,
      onToken: iteration === 0 || !hasToolCalls(messages) ? onToken : undefined,
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

      // Execute tools and add results
      const resultBlocks: ContentBlock[] = []
      for (const toolUse of toolUses) {
        onToolCall?.(toolUse.name)
        const result = await executeToolLocally(toolUse.name, toolUse.input, examProfileId, authToken)
        resultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        } as ToolResultBlock)
      }
      messages.push({ role: 'user', content: resultBlocks })

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

function hasToolCalls(messages: Message[]): boolean {
  return messages.some(m =>
    Array.isArray(m.content) &&
    m.content.some(b => 'type' in b && b.type === 'tool_use')
  )
}
