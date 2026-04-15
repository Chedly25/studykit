/**
 * Minimal agent loop hook for the /legal chat page.
 * Uses only searchLegalCodes + createFlashcardDeck tools.
 * Not coupled to ExamProfile — works independently.
 */
import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { runAgentLoop } from '../ai/agentLoop'
import { LEGAL_CHAT_SYSTEM_PROMPT } from '../ai/prompts/legalChatPrompt'
import { useExamProfile } from './useExamProfile'
import type { Message } from '../ai/types'

export interface LegalArticle {
  articleNum: string
  codeName: string
  breadcrumb: string
  text: string
  score: number
}

function extractLastArticles(messages: Message[]): LegalArticle[] {
  // Scan messages in reverse to find the last searchLegalCodes tool result
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user' || !Array.isArray(msg.content)) continue
    for (const block of msg.content) {
      if (block.type === 'tool_result' && typeof block.content === 'string') {
        try {
          const parsed = JSON.parse(block.content)
          if (parsed.resultCount !== undefined && parsed.results) {
            // Parse the formatted results string back into structured data
            const lines = String(parsed.results).split(/\n\n/)
            return lines.map(line => {
              const match = line.match(/^\d+\.\s*(.+?),\s*Art\.\s*(.+?)\s*(?:\((.+?)\))?\s*\n\s*(.+)$/s)
              if (!match) return null
              return {
                codeName: match[1].trim(),
                articleNum: match[2].trim(),
                breadcrumb: match[3]?.trim() ?? '',
                text: match[4].trim(),
                score: 0,
              }
            }).filter((a): a is LegalArticle => a !== null)
          }
        } catch { /* not our tool result */ }
      }
    }
  }
  return []
}

export function useLegalChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [currentToolCall, setCurrentToolCall] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()

  const lastArticles = extractLastArticles(messages)

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setIsLoading(true)
    setStreamingText('')
    setCurrentToolCall(null)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const token = await getToken()
      const result = await runAgentLoop({
        messages: updatedMessages,
        systemPrompt: LEGAL_CHAT_SYSTEM_PROMPT,
        examProfileId: activeProfile?.id ?? 'legal-chat',
        authToken: token ?? undefined,
        getToken: async () => getToken(),
        onToken: (t) => setStreamingText(prev => prev + t),
        onToolCall: (name) => setCurrentToolCall(name),
        onMessagesUpdate: (msgs) => setMessages(msgs),
        signal: abort.signal,
        chatUrl: '/api/legal-chat',
      })

      setMessages(result.messages)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Erreur : ${(err as Error).message}`,
        }
        setMessages(prev => [...prev, errorMsg])
      }
    } finally {
      setIsLoading(false)
      setStreamingText('')
      setCurrentToolCall(null)
      abortRef.current = null
    }
  }, [messages, isLoading, getToken, activeProfile?.id])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clear = useCallback(() => {
    setMessages([])
    setStreamingText('')
    setCurrentToolCall(null)
  }, [])

  return { messages, isLoading, streamingText, currentToolCall, lastArticles, sendMessage, cancel, clear }
}
