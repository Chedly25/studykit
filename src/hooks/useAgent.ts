import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { runAgentLoop } from '../ai/agentLoop'
import { buildSystemPrompt, buildSocraticPrompt, buildExplainBackPrompt } from '../ai/systemPrompt'
import { createConversation, loadMessages, saveMessages } from '../ai/messageStore'
import { QuotaExceededError } from '../ai/client'
import { generateSessionInsight } from '../ai/insightGenerator'
import { useSubscription } from './useSubscription'
import type { Message } from '../ai/types'
import type { ExamProfile, Subject, Topic, DailyStudyLog, Assignment, TutorPreferences, SessionInsight } from '../db/schema'
import { db } from '../db'
import { searchChunks } from '../lib/sources'

const FREE_DAILY_LIMIT = 5

function getUsageKey(): string {
  return `studieskit_ai_usage_${new Date().toISOString().slice(0, 10)}`
}

function getMessagesUsedToday(): number {
  try {
    const val = localStorage.getItem(getUsageKey())
    return val ? parseInt(val, 10) : 0
  } catch {
    return 0
  }
}

function incrementMessagesUsedToday(): void {
  try {
    const key = getUsageKey()
    const current = getMessagesUsedToday()
    localStorage.setItem(key, String(current + 1))
  } catch {
    // localStorage unavailable
  }
}

interface UseAgentOptions {
  profile: ExamProfile | undefined
  subjects: Subject[]
  topics: Topic[]
  dailyLogs: DailyStudyLog[]
  sourcesEnabled?: boolean
  tutorPreferences?: TutorPreferences
  sessionInsights?: SessionInsight[]
}

export function useAgent(options: UseAgentOptions) {
  const { profile, subjects, topics, dailyLogs, sourcesEnabled, tutorPreferences, sessionInsights } = options
  const { getToken } = useAuth()
  const { i18n } = useTranslation()
  const { isPro } = useSubscription()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentToolCall, setCurrentToolCall] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isSocratic, setIsSocratic] = useState(false)
  const [socraticTopic, setSocraticTopic] = useState<string>('')
  const [isExplainBack, setIsExplainBack] = useState(false)
  const [explainBackTopic, setExplainBackTopic] = useState<string>('')
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [messagesUsedToday, setMessagesUsedToday] = useState(getMessagesUsedToday)
  const abortRef = useRef(false)

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!profile || isLoading) return

    // Client-side quota pre-check for free users
    if (!isPro && messagesUsedToday >= FREE_DAILY_LIMIT) {
      setQuotaExceeded(true)
      setError(`You've used all ${FREE_DAILY_LIMIT} free AI messages for today. Upgrade to Pro for unlimited access.`)
      return
    }

    setError(null)
    setQuotaExceeded(false)
    setIsLoading(true)
    setStreamingText('')
    setCurrentToolCall(null)
    abortRef.current = false

    try {
      // Get or create conversation
      let convId = conversationId
      if (!convId) {
        convId = await createConversation(profile.id, userMessage.slice(0, 50))
        setConversationId(convId)
      }

      // Build messages
      const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }]
      setMessages(newMessages)

      // Get context for system prompt
      const today = new Date().toISOString().slice(0, 10)
      const dueFlashcardCount = await db.flashcards
        .where('nextReviewDate')
        .belowOrEqual(today)
        .count()
      const upcomingAssignments = await db.assignments
        .filter(a => a.status !== 'done' && a.dueDate >= today)
        .toArray() as Assignment[]

      // Build source context if sources are enabled
      let sourceContext: { documentCount: number; preRetrievedChunks?: string } | undefined
      if (sourcesEnabled) {
        const docCount = await db.documents
          .where('examProfileId')
          .equals(profile.id)
          .count()
        if (docCount > 0) {
          const relevant = await searchChunks(profile.id, userMessage, 5)
          let preRetrievedChunks: string | undefined
          if (relevant.length > 0) {
            preRetrievedChunks = relevant
              .map(r => `[Source: "${r.documentTitle}"] ${r.content}`)
              .join('\n\n')
          }
          sourceContext = { documentCount: docCount, preRetrievedChunks }
        }
      }

      const ctx = {
        profile,
        subjects,
        topics,
        dailyLogs,
        dueFlashcardCount,
        upcomingAssignments: upcomingAssignments.slice(0, 5),
        sourceContext,
        tutorPreferences,
        sessionInsights,
        language: i18n.language,
      }

      const systemPrompt = isExplainBack && explainBackTopic
        ? buildExplainBackPrompt(ctx, explainBackTopic)
        : isSocratic && socraticTopic
        ? buildSocraticPrompt(ctx, socraticTopic)
        : buildSystemPrompt(ctx)

      // Get auth token for API requests
      const authToken = await getToken() ?? undefined

      if (!authToken) {
        setError('You must be signed in to use the AI assistant.')
        setIsLoading(false)
        return
      }

      // Run agent loop
      const result = await runAgentLoop({
        messages: newMessages,
        systemPrompt,
        examProfileId: profile.id,
        authToken,
        onToken: (text) => {
          if (!abortRef.current) {
            setStreamingText(prev => prev + text)
          }
        },
        onToolCall: (name) => {
          setCurrentToolCall(name)
        },
      })

      setMessages(result.messages)
      setStreamingText('')
      setCurrentToolCall(null)
      await saveMessages(convId, result.messages)

      // Track usage for free users
      if (!isPro) {
        incrementMessagesUsedToday()
        setMessagesUsedToday(getMessagesUsedToday())
      }
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setQuotaExceeded(true)
        setError(err.message)
      } else {
        const msg = err instanceof Error ? err.message : 'An error occurred'
        setError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [profile, subjects, topics, dailyLogs, messages, conversationId, isLoading, isSocratic, socraticTopic, isExplainBack, explainBackTopic, getToken, isPro, messagesUsedToday, sourcesEnabled, tutorPreferences, sessionInsights])

  const loadConversation = useCallback(async (convId: string) => {
    const msgs = await loadMessages(convId)
    setMessages(msgs)
    setConversationId(convId)
  }, [])

  const newConversation = useCallback(async () => {
    // Generate insight from outgoing conversation if it had enough messages
    const userMsgCount = messages.filter(m => m.role === 'user' && typeof m.content === 'string').length
    if (userMsgCount >= 4 && conversationId && profile) {
      const token = await getToken()
      if (token) {
        generateSessionInsight(messages, profile.id, conversationId, token).catch(console.warn)
      }
    }
    setMessages([])
    setConversationId(null)
    setStreamingText('')
    setError(null)
    setIsSocratic(false)
    setSocraticTopic('')
    setIsExplainBack(false)
    setExplainBackTopic('')
  }, [messages, conversationId, profile, getToken])

  const startSocraticMode = useCallback((topicName: string) => {
    setIsSocratic(true)
    setSocraticTopic(topicName)
    setMessages([])
    setConversationId(null)
    setStreamingText('')
    setError(null)
    setIsExplainBack(false)
    setExplainBackTopic('')
  }, [])

  const startExplainBackMode = useCallback((topicName: string) => {
    setIsExplainBack(true)
    setExplainBackTopic(topicName)
    setMessages([])
    setConversationId(null)
    setStreamingText('')
    setError(null)
    setIsSocratic(false)
    setSocraticTopic('')
  }, [])

  return {
    messages,
    isLoading,
    currentToolCall,
    streamingText,
    error,
    conversationId,
    isSocratic,
    isExplainBack,
    quotaExceeded,
    messagesUsedToday,
    sendMessage,
    loadConversation,
    newConversation,
    startSocraticMode,
    startExplainBackMode,
  }
}
