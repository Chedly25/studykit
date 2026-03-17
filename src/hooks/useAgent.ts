import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { runAgentLoop } from '../ai/agentLoop'
import { buildSystemPrompt, buildSocraticPrompt, buildExplainBackPrompt } from '../ai/systemPrompt'
import { createConversation, loadMessages, saveMessages } from '../ai/messageStore'
import { QuotaExceededError } from '../ai/client'
import { generateSessionInsight } from '../ai/insightGenerator'
import { useSubscription } from './useSubscription'
import type { Message } from '../ai/types'
import type { ExamProfile, Subject, Topic, DailyStudyLog, Assignment, TutorPreferences, SessionInsight, StudentModel, ConversationSummary, ExamFormat } from '../db/schema'
import { db } from '../db'
import { semanticSearch } from '../lib/embeddings'

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
  studentModel?: StudentModel
  conversationSummaries?: ConversationSummary[]
}

export function useAgent(options: UseAgentOptions) {
  const { profile, subjects, topics, dailyLogs, sourcesEnabled, tutorPreferences, sessionInsights, studentModel, conversationSummaries } = options
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
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (userMessage: string, attachmentContext?: { chunks: Array<{ content: string; documentTitle: string; chunkIndex: number }> }): Promise<Message[]> => {
    if (!profile || isLoading) return []

    // Client-side quota pre-check for free users
    if (!isPro && messagesUsedToday >= FREE_DAILY_LIMIT) {
      setQuotaExceeded(true)
      setError(`You've used all ${FREE_DAILY_LIMIT} free AI messages for today. Upgrade to Pro for unlimited access.`)
      return []
    }

    setError(null)
    setQuotaExceeded(false)
    setIsLoading(true)
    setStreamingText('')
    setCurrentToolCall(null)
    abortRef.current = false
    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController

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

      // Get auth token early (needed for semantic search + API calls)
      const authToken = await getToken() ?? undefined

      if (!authToken) {
        setError('You must be signed in to use the AI assistant.')
        setIsLoading(false)
        return []
      }

      // Build source context if sources are enabled
      let sourceContext: { documentCount: number; preRetrievedChunks?: string } | undefined
      if (sourcesEnabled) {
        const docCount = await db.documents
          .where('examProfileId')
          .equals(profile.id)
          .count()
        if (docCount > 0) {
          const relevant = await semanticSearch(profile.id, userMessage, authToken ?? undefined, 5)
          let preRetrievedChunks: string | undefined
          if (relevant.length > 0) {
            preRetrievedChunks = relevant
              .map(r => `[Source: "${r.documentTitle}", §${r.chunkIndex}]\n${r.content}`)
              .join('\n\n')
          }
          sourceContext = { documentCount: docCount, preRetrievedChunks }
        }
      }

      // Inject attachment chunks (always, regardless of sources toggle)
      if (attachmentContext && attachmentContext.chunks.length > 0) {
        const attachmentText = attachmentContext.chunks
          .map(c => `[Attachment: "${c.documentTitle}", §${c.chunkIndex}]\n${c.content}`)
          .join('\n\n')
        if (sourceContext) {
          sourceContext.preRetrievedChunks = sourceContext.preRetrievedChunks
            ? `${sourceContext.preRetrievedChunks}\n\n${attachmentText}`
            : attachmentText
        } else {
          sourceContext = { documentCount: 0, preRetrievedChunks: attachmentText }
        }
      }

      // Load exam formats
      const examFormats = await db.examFormats.where('examProfileId').equals(profile.id).toArray() as ExamFormat[]

      // Build flashcard performance data
      let flashcardPerformance: Array<{ deckName: string; cardCount: number; retentionRate: number; dueCount: number; averageEaseFactor: number }> | undefined
      const decks = await db.flashcardDecks.where('examProfileId').equals(profile.id).toArray()
      if (decks.length > 0) {
        const today = new Date().toISOString().slice(0, 10)
        flashcardPerformance = await Promise.all(decks.map(async deck => {
          const cards = await db.flashcards.where('deckId').equals(deck.id).toArray()
          const retained = cards.filter(c => c.easeFactor >= 2.5 && c.repetitions >= 2).length
          const due = cards.filter(c => c.nextReviewDate <= today).length
          const avgEF = cards.length > 0 ? cards.reduce((s, c) => s + c.easeFactor, 0) / cards.length : 2.5
          return {
            deckName: deck.name,
            cardCount: cards.length,
            retentionRate: cards.length > 0 ? Math.round((retained / cards.length) * 100) : 0,
            dueCount: due,
            averageEaseFactor: Math.round(avgEF * 100) / 100,
          }
        }))
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
        studentModel,
        conversationSummaries,
        flashcardPerformance,
        examFormats: examFormats.length > 0 ? examFormats : undefined,
      }

      const systemPrompt = isExplainBack && explainBackTopic
        ? buildExplainBackPrompt(ctx, explainBackTopic)
        : isSocratic && socraticTopic
        ? buildSocraticPrompt(ctx, socraticTopic)
        : buildSystemPrompt(ctx)

      // Run agent loop
      const result = await runAgentLoop({
        messages: newMessages,
        systemPrompt,
        examProfileId: profile.id,
        authToken,
        signal: abortController.signal,
        onToken: (text) => {
          if (!abortRef.current) {
            setStreamingText(prev => prev + text)
          }
        },
        onToolCall: (name) => {
          setCurrentToolCall(name)
          setStreamingText('')
        },
        onMessagesUpdate: (msgs) => {
          setMessages(msgs)
          setStreamingText('')
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

      return result.messages
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setQuotaExceeded(true)
        setError(err.message)
      } else {
        const msg = err instanceof Error ? err.message : 'An error occurred'
        setError(msg)
      }
      return []
    } finally {
      setIsLoading(false)
    }
  }, [profile, subjects, topics, dailyLogs, messages, conversationId, isLoading, isSocratic, socraticTopic, isExplainBack, explainBackTopic, getToken, isPro, messagesUsedToday, sourcesEnabled, tutorPreferences, sessionInsights, studentModel, conversationSummaries, i18n.language])

  // Track conversation state in refs for beforeunload handler
  const messagesRef = useRef(messages)
  const conversationIdRef = useRef(conversationId)
  const profileRef = useRef(profile)
  messagesRef.current = messages
  conversationIdRef.current = conversationId
  profileRef.current = profile

  // Generate insight on page unload to prevent lost sessions
  useEffect(() => {
    const handleUnload = () => {
      const msgs = messagesRef.current
      const convId = conversationIdRef.current
      const prof = profileRef.current
      const userMsgCount = msgs.filter(m => m.role === 'user' && typeof m.content === 'string').length
      if (userMsgCount >= 4 && convId && prof) {
        // Use sendBeacon-style: fire and forget via getToken stored in closure
        getToken().then(token => {
          if (token) generateSessionInsight(msgs, prof.id, convId, token).catch(() => {})
        }).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [getToken])

  const loadConversation = useCallback(async (convId: string) => {
    // Generate insight for the outgoing conversation before loading new one
    const userMsgCount = messages.filter(m => m.role === 'user' && typeof m.content === 'string').length
    if (userMsgCount >= 4 && conversationId && profile) {
      const token = await getToken()
      if (token) {
        generateSessionInsight(messages, profile.id, conversationId, token).catch(console.warn)
      }
    }
    const msgs = await loadMessages(convId)
    setMessages(msgs)
    setConversationId(convId)
  }, [messages, conversationId, profile, getToken])

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

  const cancel = useCallback(() => {
    abortRef.current = true
    abortControllerRef.current?.abort()
  }, [])

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
    cancel,
    loadConversation,
    newConversation,
    startSocraticMode,
    startExplainBackMode,
  }
}
