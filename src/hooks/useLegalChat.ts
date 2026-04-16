/**
 * Minimal agent loop hook for the /legal chat page.
 * Uses only searchLegalCodes + createFlashcardDeck tools.
 * Persists conversations to IndexedDB so history survives refresh.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { runAgentLoop } from '../ai/agentLoop'
import { LEGAL_CHAT_SYSTEM_PROMPT } from '../ai/prompts/legalChatPrompt'
import { useExamProfile } from './useExamProfile'
import {
  createConversation,
  getConversations,
  loadMessages,
  saveMessages,
  updateConversationTitle,
  deleteConversation,
} from '../ai/messageStore'
import type { Message } from '../ai/types'
import type { Conversation } from '../db/schema'

const LEGAL_PROFILE_ID = 'legal-chat' // Virtual profile ID for legal conversations

export interface LegalArticle {
  articleNum: string
  codeName: string
  breadcrumb: string
  text: string
  score: number
}

function extractLastArticles(messages: Message[]): LegalArticle[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'user' || !Array.isArray(msg.content)) continue
    for (const block of msg.content) {
      if (block.type === 'tool_result' && typeof block.content === 'string') {
        try {
          const parsed = JSON.parse(block.content)
          if (parsed.resultCount !== undefined && parsed.results) {
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

function deriveTitle(firstUserMessage: string): string {
  // Strip the attached documents context
  const clean = firstUserMessage.split('\n\n## Contexte')[0].trim()
  return clean.slice(0, 80) + (clean.length > 80 ? '...' : '')
}

export function useLegalChat() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [currentToolCall, setCurrentToolCall] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()

  const lastArticles = extractLastArticles(messages)

  // Load conversation list on mount
  const refreshConversations = useCallback(async () => {
    const convs = await getConversations(LEGAL_PROFILE_ID)
    setConversations(convs)
  }, [])

  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  // Load most recent conversation on mount (or leave empty for new chat)
  useEffect(() => {
    let cancelled = false
    getConversations(LEGAL_PROFILE_ID).then(async (convs) => {
      if (cancelled) return
      if (convs.length > 0 && !conversationId) {
        const mostRecent = convs[0]
        setConversationId(mostRecent.id)
        const msgs = await loadMessages(mostRecent.id)
        if (!cancelled) setMessages(msgs)
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectConversation = useCallback(async (id: string) => {
    setConversationId(id)
    const msgs = await loadMessages(id)
    setMessages(msgs)
    setStreamingText('')
    setCurrentToolCall(null)
  }, [])

  const newConversation = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setStreamingText('')
    setCurrentToolCall(null)
  }, [])

  const removeConversation = useCallback(async (id: string) => {
    await deleteConversation(id)
    if (id === conversationId) {
      setConversationId(null)
      setMessages([])
    }
    await refreshConversations()
  }, [conversationId, refreshConversations])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    // Create conversation on first message
    let convId = conversationId
    if (!convId) {
      convId = await createConversation(LEGAL_PROFILE_ID, deriveTitle(text))
      setConversationId(convId)
      await refreshConversations()
    }

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
      // Persist to IndexedDB
      await saveMessages(convId, result.messages)
      await refreshConversations()
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
  }, [messages, isLoading, getToken, activeProfile?.id, conversationId, refreshConversations])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const renameConversation = useCallback(async (id: string, title: string) => {
    await updateConversationTitle(id, title)
    await refreshConversations()
  }, [refreshConversations])

  return {
    messages,
    conversations,
    conversationId,
    isLoading,
    streamingText,
    currentToolCall,
    lastArticles,
    sendMessage,
    cancel,
    selectConversation,
    newConversation,
    removeConversation,
    renameConversation,
  }
}
