/**
 * Hook for the plan canvas AI agent.
 * Provides sendMessage(), isLoading, messages, suggestions, and plan update dispatch.
 */
import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { runCanvasAgentLoop, type CanvasAgentResult } from '../ai/canvasAgentLoop'
import { buildCanvasSystemPrompt } from '../ai/canvasSystemPrompt'
import type { Message } from '../ai/types'
import type { WizardDraft, WizardAction, PlanDraftData } from './useWizardDraft'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export function usePlanCanvasAgent(draft: WizardDraft, dispatch: React.Dispatch<WizardAction>) {
  const { getToken } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [currentToolCall, setCurrentToolCall] = useState<string | null>(null)
  const agentMessagesRef = useRef<Message[]>([])

  const sendMessage = useCallback(async (text: string) => {
    if (!draft.planDraft || isLoading) return

    const token = await getToken()
    if (!token) return

    // Add user message to chat
    setChatMessages(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }])
    setIsLoading(true)
    setStreamingText('')

    // Build messages for agent
    agentMessagesRef.current.push({ id: crypto.randomUUID(), role: 'user', content: text })

    try {
      const systemPrompt = buildCanvasSystemPrompt(draft)
      const result: CanvasAgentResult = await runCanvasAgentLoop({
        messages: agentMessagesRef.current,
        systemPrompt,
        plan: draft.planDraft,
        authToken: token,
        onToken: (token) => setStreamingText(prev => prev + token),
        onToolCall: (name) => setCurrentToolCall(name),
        onPlanUpdate: (updatedPlan: PlanDraftData) => {
          dispatch({ type: 'SET_PLAN_DRAFT', plan: updatedPlan })
        },
      })

      // Update agent message history
      agentMessagesRef.current = result.messages

      // Add assistant response to chat
      if (result.finalText) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: result.finalText,
          timestamp: Date.now(),
        }])
      }

      // Update suggestions (plan already updated incrementally via onPlanUpdate)
      if (result.suggestions.length > 0) {
        setSuggestions(prev => [...prev, ...result.suggestions])
      }
    } catch (err) {
      console.error('Canvas agent error:', err)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.',
        timestamp: Date.now(),
      }])
    } finally {
      setIsLoading(false)
      setStreamingText('')
      setCurrentToolCall(null)
    }
  }, [draft, isLoading, getToken, dispatch])

  const dismissSuggestion = useCallback((index: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index))
  }, [])

  return {
    sendMessage,
    isLoading,
    streamingText,
    chatMessages,
    suggestions,
    dismissSuggestion,
    currentToolCall,
  }
}
