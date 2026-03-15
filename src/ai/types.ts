/**
 * AI agent types — message formats, tool calls, agent state.
 */

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

export interface Message {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
  reasoning_content?: string
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface StreamEvent {
  type: string
  index?: number
  delta?: {
    type?: string
    text?: string
    partial_json?: string
  }
  content_block?: {
    type: string
    id?: string
    name?: string
    text?: string
  }
  message?: {
    id: string
    model: string
    stop_reason: string | null
    usage: { input_tokens: number; output_tokens: number }
  }
}

export interface AgentState {
  conversationId: string
  examProfileId: string
  messages: Message[]
  isLoading: boolean
  currentToolCall: string | null
  error: string | null
}
