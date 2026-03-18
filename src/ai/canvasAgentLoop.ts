/**
 * Lightweight agent loop for the plan canvas.
 * Max 5 iterations, 60s timeout. Operates on PlanDraftData via pure functions.
 */
import { streamChat } from './client'
import { canvasTools } from './canvasToolDefinitions'
import type { Message, ContentBlock, ToolResultBlock } from './types'
import type { PlanDraftData } from '../hooks/useWizardDraft'
import {
  addActivity,
  removeActivity,
  moveActivity,
  replaceActivity,
  clearDay,
} from './tools/canvasTools'

const MAX_ITERATIONS = 5
const TIMEOUT_MS = 60000

export interface CanvasAgentResult {
  messages: Message[]
  finalText: string
  updatedPlan: PlanDraftData
  suggestions: string[]
}

interface CanvasAgentOptions {
  messages: Message[]
  systemPrompt: string
  plan: PlanDraftData
  authToken: string
  onToken?: (text: string) => void
  onToolCall?: (toolName: string) => void
  onPlanUpdate?: (plan: PlanDraftData) => void
  signal?: AbortSignal
}

function executeCanvasTool(
  toolName: string,
  input: Record<string, unknown>,
  plan: PlanDraftData,
): { plan: PlanDraftData; result: string; suggestion?: string } {
  switch (toolName) {
    case 'addActivity':
      return addActivity(plan, input as Parameters<typeof addActivity>[1])
    case 'removeActivity':
      return removeActivity(plan, input as Parameters<typeof removeActivity>[1])
    case 'moveActivity':
      return moveActivity(plan, input as Parameters<typeof moveActivity>[1])
    case 'replaceActivity':
      return replaceActivity(plan, input as Parameters<typeof replaceActivity>[1])
    case 'clearDay':
      return clearDay(plan, input as Parameters<typeof clearDay>[1])
    case 'rebalanceWeek':
      // Handled externally — return a signal that triggers regeneration
      return { plan, result: JSON.stringify({ signal: 'rebalance_requested', focusTopics: input.focusTopics ?? [] }) }
    case 'suggestChange':
      return { plan, result: JSON.stringify({ success: true }), suggestion: input.message as string }
    default:
      return { plan, result: JSON.stringify({ error: `Unknown tool: ${toolName}` }) }
  }
}

export async function runCanvasAgentLoop(options: CanvasAgentOptions): Promise<CanvasAgentResult> {
  const { systemPrompt, authToken, onToken, onToolCall, onPlanUpdate, signal } = options
  const messages = [...options.messages]
  let currentPlan = options.plan
  let finalText = ''
  const suggestions: string[] = []

  const startTime = Date.now()

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    if (signal?.aborted) break
    if (Date.now() - startTime > TIMEOUT_MS) {
      finalText += '\n\n[Timed out]'
      break
    }

    const response = await streamChat({
      messages,
      system: systemPrompt,
      tools: canvasTools,
      authToken,
      onToken,
      onToolCall,
      signal,
    })

    const toolUses = response.content.filter(
      (c): c is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        c.type === 'tool_use'
    )
    const textBlocks = response.content.filter(
      (c): c is { type: 'text'; text: string } => c.type === 'text'
    )

    if (toolUses.length > 0) {
      // Build assistant message
      const assistantContent: ContentBlock[] = []
      for (const block of response.content) {
        if (block.type === 'text') assistantContent.push({ type: 'text', text: block.text })
        else if (block.type === 'tool_use') assistantContent.push(block)
      }
      const assistantMsg: Message = { role: 'assistant', content: assistantContent }
      if (response.reasoningContent) assistantMsg.reasoning_content = response.reasoningContent
      messages.push(assistantMsg)

      // Execute tools
      const resultBlocks: ContentBlock[] = []
      for (const toolUse of toolUses) {
        onToolCall?.(toolUse.name)
        try {
          const { plan: newPlan, result, suggestion } = executeCanvasTool(toolUse.name, toolUse.input, currentPlan)
          currentPlan = newPlan
          onPlanUpdate?.(currentPlan)
          if (suggestion) suggestions.push(suggestion)

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
      messages.push({ role: 'user', content: resultBlocks })
      continue
    }

    // No tool calls — final text response
    const text = textBlocks.map(b => b.text).join('')
    finalText += text
    messages.push({ role: 'assistant', content: text })
    break
  }

  return { messages, finalText, updatedPlan: currentPlan, suggestions }
}
