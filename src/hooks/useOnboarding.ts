/**
 * React hook for LLM-powered conversational onboarding.
 * Uses an agent loop: the LLM calls tools to render widgets and execute DB writes.
 * Falls back to the scripted onboardingFlow after repeated failures.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { streamChat } from '../ai/client'
import { db } from '../db'
import type { Message, ContentBlock, ToolUseBlock } from '../ai/types'
import {
  type ConversationalOnboardingState,
  type DisplayMessage,
  type PendingWidget,
  type OnboardingToolResult,
  createInitialConversationalState,
  buildOnboardingSystemPrompt,
  onboardingToolDefs,
  executeOnboardingTool,
} from '../ai/workflows/onboardingAgent'

const STORAGE_KEY = 'onboarding_state_v2'
const OLD_STORAGE_KEY = 'onboarding_state'
const MAX_AGENT_ITERATIONS = 5
const MAX_RETRIES_BEFORE_FALLBACK = 2

// ─── Persistence helpers ─────────────────────────────────

type PersistedState = Pick<
  ConversationalOnboardingState,
  'messages' | 'displayMessages' | 'profileId' | 'examName' |
  'extractedSubjects' | 'topicsSeeded' | 'weeklyHoursSet' | 'completed' | 'useFallback'
>

function loadState(): ConversationalOnboardingState | null {
  try {
    // Detect old format and clear it
    const oldRaw = sessionStorage.getItem(OLD_STORAGE_KEY)
    if (oldRaw) {
      const oldParsed = JSON.parse(oldRaw)
      if (oldParsed && 'step' in oldParsed) {
        sessionStorage.removeItem(OLD_STORAGE_KEY)
      }
    }

    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const persisted: PersistedState = JSON.parse(raw)
    return {
      ...createInitialConversationalState(),
      ...persisted,
    }
  } catch {
    return null
  }
}

function saveState(state: ConversationalOnboardingState) {
  try {
    const persisted: PersistedState = {
      messages: state.messages,
      displayMessages: state.displayMessages,
      profileId: state.profileId,
      examName: state.examName,
      extractedSubjects: state.extractedSubjects,
      topicsSeeded: state.topicsSeeded,
      weeklyHoursSet: state.weeklyHoursSet,
      completed: state.completed,
      useFallback: state.useFallback,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
  } catch { /* quota exceeded — non-fatal */ }
}

// ─── Hook ────────────────────────────────────────────────

export function useOnboarding() {
  const { userId, getToken } = useAuth()
  const effectiveUserId = userId ?? 'local'

  const [state, setState] = useState<ConversationalOnboardingState>(
    () => loadState() ?? createInitialConversationalState(),
  )
  const stateRef = useRef(state)
  stateRef.current = state

  const retryCountRef = useRef(0)

  // Persist to sessionStorage on every change (skip transient fields via saveState)
  useEffect(() => { saveState(state) }, [state])

  // ── Agent loop ─────────────────────────────────────────

  const sendMessage = useCallback(async (userText?: string) => {
    // 1. If user provided text, append user message
    if (userText) {
      const userMsg: Message = { role: 'user', content: userText }
      const userDisplay: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userText,
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMsg],
        displayMessages: [...prev.displayMessages, userDisplay],
      }))
      // Update ref so the loop sees the latest messages
      stateRef.current = {
        ...stateRef.current,
        messages: [...stateRef.current.messages, userMsg],
        displayMessages: [...stateRef.current.displayMessages, userDisplay],
      }
    }

    // 2. Start streaming
    let streamingText = ''
    setState(prev => ({ ...prev, isStreaming: true, streamingText: '', error: null }))

    try {
      const token = await getToken()
      if (!token) {
        // Auth not ready yet — set error so UI can retry
        setState(prev => ({ ...prev, isStreaming: false, error: 'Waiting for authentication...' }))
        return
      }

      // 3. Agent loop
      for (let iter = 0; iter < MAX_AGENT_ITERATIONS; iter++) {
        streamingText = ''
        setState(prev => ({ ...prev, streamingText: '' }))

        const response = await streamChat({
          messages: stateRef.current.messages as Message[],
          system: buildOnboardingSystemPrompt(),
          tools: onboardingToolDefs,
          maxTokens: 1024,
          authToken: token ?? undefined,
          onToken: (t: string) => {
            streamingText += t
            setState(prev => ({ ...prev, streamingText }))
          },
        })

        // c. Parse response content
        const contentBlocks = response.content as ContentBlock[]
        const textBlocks = contentBlocks.filter(b => b.type === 'text')
        const toolUseBlocks = contentBlocks.filter((b): b is ToolUseBlock => b.type === 'tool_use')

        // d. Build assistant message and push to messages
        const assistantMsg: Message = { role: 'assistant', content: contentBlocks }
        stateRef.current = {
          ...stateRef.current,
          messages: [...stateRef.current.messages, assistantMsg],
        }
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMsg],
        }))

        // e. Extract text → display message
        const textContent = textBlocks
          .map(b => b.type === 'text' ? b.text : '')
          .join('')
          .trim()

        if (textContent) {
          const displayMsg: DisplayMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: textContent,
          }
          stateRef.current = {
            ...stateRef.current,
            displayMessages: [...stateRef.current.displayMessages, displayMsg],
          }
          setState(prev => ({
            ...prev,
            displayMessages: [...prev.displayMessages, displayMsg],
          }))
        }

        // f. Handle tool calls
        if (toolUseBlocks.length > 0) {
          let shouldBreak = false

          for (const toolUse of toolUseBlocks) {
            // Build context for tool executor
            const toolContext = {
              profileId: stateRef.current.profileId,
              userId: effectiveUserId,
              authToken: token,
              setProfileId: (id: string) => {
                stateRef.current = { ...stateRef.current, profileId: id }
                setState(prev => ({ ...prev, profileId: id }))
              },
              setExtractedSubjects: (subjects: typeof stateRef.current.extractedSubjects) => {
                stateRef.current = { ...stateRef.current, extractedSubjects: subjects }
                setState(prev => ({ ...prev, extractedSubjects: subjects }))
              },
              setTopicsSeeded: (v: boolean) => {
                stateRef.current = { ...stateRef.current, topicsSeeded: v }
                setState(prev => ({ ...prev, topicsSeeded: v }))
              },
              setWeeklyHoursSet: (v: boolean) => {
                stateRef.current = { ...stateRef.current, weeklyHoursSet: v }
                setState(prev => ({ ...prev, weeklyHoursSet: v }))
              },
              setExamName: (name: string) => {
                stateRef.current = { ...stateRef.current, examName: name }
                setState(prev => ({ ...prev, examName: name }))
              },
            }

            const result: OnboardingToolResult = await executeOnboardingTool(
              toolUse.name,
              toolUse.input,
              toolContext,
            )

            if (result.type === 'widget') {
              // Add display message with widget
              const widgetDisplay: DisplayMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: result.message,
                widget: { type: result.widgetType, config: result.config },
              }
              const pending: PendingWidget = {
                type: result.widgetType as PendingWidget['type'],
                config: result.config,
                toolCallId: toolUse.id,
              }

              // Push placeholder tool_result
              const toolResultMsg: Message = {
                role: 'user',
                content: [{
                  type: 'tool_result',
                  tool_use_id: toolUse.id,
                  content: 'Waiting for user input...',
                }],
              }

              stateRef.current = {
                ...stateRef.current,
                displayMessages: [...stateRef.current.displayMessages, widgetDisplay],
                messages: [...stateRef.current.messages, toolResultMsg],
                pendingWidget: pending,
              }
              setState(prev => ({
                ...prev,
                displayMessages: [...prev.displayMessages, widgetDisplay],
                messages: [...prev.messages, toolResultMsg],
                pendingWidget: pending,
              }))

              shouldBreak = true
              break
            }

            if (result.type === 'terminal') {
              // Add summary display message
              const summaryDisplay: DisplayMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: 'Here\'s your study plan summary:',
                widget: { type: 'summary', config: result.summaryData },
              }

              stateRef.current = {
                ...stateRef.current,
                displayMessages: [...stateRef.current.displayMessages, summaryDisplay],
                completed: true,
              }
              setState(prev => ({
                ...prev,
                displayMessages: [...prev.displayMessages, summaryDisplay],
                completed: true,
              }))

              shouldBreak = true
              break
            }

            if (result.type === 'result') {
              // Push tool_result and continue loop
              const toolResultMsg: Message = {
                role: 'user',
                content: [{
                  type: 'tool_result',
                  tool_use_id: toolUse.id,
                  content: result.content,
                }],
              }

              stateRef.current = {
                ...stateRef.current,
                messages: [...stateRef.current.messages, toolResultMsg],
              }
              setState(prev => ({
                ...prev,
                messages: [...prev.messages, toolResultMsg],
              }))
            }
          }

          if (shouldBreak) break
          // Tool results pushed — continue agent loop to let LLM respond
          continue
        }

        // g. No tool calls (text-only response) — break
        break
      }

      // Success — reset retry counter
      retryCountRef.current = 0
    } catch (err) {
      console.error('Onboarding agent error:', err)
      retryCountRef.current += 1

      if (retryCountRef.current >= MAX_RETRIES_BEFORE_FALLBACK) {
        setState(prev => ({
          ...prev,
          useFallback: true,
          error: 'Switching to guided mode after repeated failures.',
        }))
      } else {
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        }))
      }
    } finally {
      setState(prev => ({ ...prev, isStreaming: false, streamingText: '' }))
      // Persist after the loop completes
      saveState(stateRef.current)
    }
  }, [effectiveUserId, getToken])

  // ── Widget response ────────────────────────────────────

  const respondToWidget = useCallback(async (result: string) => {
    const pending = stateRef.current.pendingWidget
    if (!pending) return

    // Clear pending widget
    stateRef.current = { ...stateRef.current, pendingWidget: null }
    setState(prev => ({ ...prev, pendingWidget: null }))

    // Add user display message with human-readable result
    const userDisplay: DisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: result,
    }
    stateRef.current = {
      ...stateRef.current,
      displayMessages: [...stateRef.current.displayMessages, userDisplay],
    }
    setState(prev => ({
      ...prev,
      displayMessages: [...prev.displayMessages, userDisplay],
    }))

    // Push the real tool_result message (replacing the placeholder)
    const toolResultMsg: Message = {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: pending.toolCallId,
        content: result,
      }],
    }

    // Find and remove the placeholder tool_result, then add the real one
    const updatedMessages = stateRef.current.messages.filter(msg => {
      if (typeof msg.content === 'string') return true
      if (!Array.isArray(msg.content)) return true
      const hasPlaceholder = msg.content.some(
        b => b.type === 'tool_result' &&
        'tool_use_id' in b &&
        b.tool_use_id === pending.toolCallId &&
        'content' in b &&
        b.content === 'Waiting for user input...',
      )
      return !hasPlaceholder
    })
    updatedMessages.push(toolResultMsg)

    stateRef.current = { ...stateRef.current, messages: updatedMessages }
    setState(prev => ({ ...prev, messages: updatedMessages }))

    // Re-enter the agent loop
    await sendMessage()
  }, [sendMessage])

  // ── Complete onboarding ────────────────────────────────

  const completeOnboarding = useCallback(async () => {
    const profileId = stateRef.current.profileId
    if (!profileId) return

    await db.examProfiles.toCollection().modify({ isActive: false })
    await db.examProfiles.update(profileId, { isActive: true })

    // Auto-process uploaded documents
    try {
      const docs = await db.documents.where('examProfileId').equals(profileId).toArray()
      const unprocessed = docs.filter(d => !d.summary)
      const now = new Date().toISOString()
      for (const doc of unprocessed) {
        await db.backgroundJobs.put({
          id: crypto.randomUUID(),
          examProfileId: profileId,
          type: 'source-processing' as const,
          status: 'queued' as const,
          config: JSON.stringify({ documentId: doc.id, isPro: true }),
          completedStepIds: '[]',
          stepResults: '{}',
          totalSteps: 4,
          completedStepCount: 0,
          currentStepName: '',
          createdAt: now,
          updatedAt: now,
        })
      }
    } catch { /* non-blocking */ }

    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  // ── Reset ──────────────────────────────────────────────

  const resetOnboarding = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(OLD_STORAGE_KEY)
    retryCountRef.current = 0
    const fresh = createInitialConversationalState()
    stateRef.current = fresh
    setState(fresh)
  }, [])

  return { state, sendMessage, respondToWidget, completeOnboarding, resetOnboarding }
}
