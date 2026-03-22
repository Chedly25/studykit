import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { runAgentLoop } from '../ai/agentLoop'
import { buildSessionPrompt, buildSourceSection } from '../ai/systemPrompt'
import type { SessionContext } from '../ai/systemPrompt'
import { buildAdaptivePrompt } from '../ai/adaptivePrompt'
import { routeChat } from '../ai/agents/chatRouter'
import { recallEpisodes } from '../ai/memory/episodicMemory'
import { createConversation, loadMessages, saveMessages } from '../ai/messageStore'
import { QuotaExceededError } from '../ai/client'
import { generateSessionInsight } from '../ai/insightGenerator'
import { useSubscription } from './useSubscription'
import { track } from '../lib/analytics'
import type { Message } from '../ai/types'
import type { ExamProfile, Subject, Topic, DailyStudyLog, Assignment, TutorPreferences, SessionInsight, StudentModel, ConversationSummary, ExamFormat } from '../db/schema'
import { db } from '../db'
import { hybridSearch } from '../lib/hybridSearch'

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
  sessionContext?: SessionContext
  customSystemPrompt?: string
  subjectId?: string | null
  subjectName?: string | null
}

export function useAgent(options: UseAgentOptions) {
  const { profile, subjects, topics, dailyLogs, sourcesEnabled, tutorPreferences, sessionInsights, studentModel, conversationSummaries, customSystemPrompt, subjectId, subjectName } = options
  const { getToken } = useAuth()
  const { i18n } = useTranslation()
  const { isPro } = useSubscription()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentToolCall, setCurrentToolCall] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
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
      // Scope due flashcards to current profile's decks
      const profileDecks = await db.flashcardDecks
        .where('examProfileId').equals(profile.id).toArray()
      const profileDeckIds = new Set(profileDecks.map(d => d.id))
      const dueFlashcardCount = await db.flashcards
        .where('nextReviewDate')
        .belowOrEqual(today)
        .filter(c => profileDeckIds.has(c.deckId))
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
          const relevant = await hybridSearch(profile.id, userMessage, authToken ?? undefined, { topN: 5, subjectId: subjectId ?? undefined })
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

      // Refresh token before prompt building (needed for goal decomposition + routing)
      const freshToken = await getToken() ?? authToken

      // Build system prompt — adaptive by default, with auto-routing
      let systemPrompt: string
      if (customSystemPrompt) {
        systemPrompt = customSystemPrompt
        if (sourceContext) {
          systemPrompt += buildSourceSection(sourceContext)
        }
      } else if (options.sessionContext) {
        systemPrompt = buildSessionPrompt(ctx, options.sessionContext)
      } else {
        // Adaptive prompt: base + student model + episodes + calibration + misconceptions
        const userId = profile.userId ?? ''
        systemPrompt = await buildAdaptivePrompt({
          ...ctx,
          userId,
          currentTopicId: undefined,
        })

        // Goal decomposition for complex requests (first message only)
        const userMsgCount = newMessages.filter(m => m.role === 'user').length
        if (userMsgCount === 1 && freshToken) {
          try {
            const { decomposeGoal, formatPlanForPrompt } = await import('../ai/planner/goalDecomposer')
            const { callFastModel } = await import('../ai/fastClient')
            const diagnosticInsight = await db.agentInsights.get(`diagnostician:${profile.id}`)
            const report = diagnosticInsight ? JSON.parse(diagnosticInsight.data) : null
            const plan = await decomposeGoal(
              userMessage, topics, report,
              (prompt: string, system?: string) => callFastModel(prompt, system ?? '', freshToken, { maxTokens: 512 }),
            )
            if (plan && plan.isComplex) {
              systemPrompt += formatPlanForPrompt(plan)
            }
          } catch { /* non-fatal */ }
        }

        // Auto-route teaching approach (only after 3+ user messages for enough context)
        if (userMsgCount >= 3 && freshToken) {
          try {
            const sm = await db.studentModels.get(profile.id)
            const episodes = userId ? await recallEpisodes({ userId, limit: 5 }) : []
            const routing = await routeChat(newMessages, sm, null, episodes, freshToken)
            if (routing.addendum) {
              systemPrompt += `\n\n## Teaching Approach\n${routing.addendum}`
            }
          } catch { /* non-fatal — use base adaptive prompt */ }
        }

        // Subject specialist context
        if (subjectId && subjectName) {
          systemPrompt += `\n\n## Subject Focus\nYou are the student's ${subjectName} specialist. Focus your answers on ${subjectName}. Reference the student's ${subjectName} materials. When searching sources, prioritize ${subjectName} content.`
        }
      }

      // Run agent loop
      const result = await runAgentLoop({
        messages: newMessages,
        systemPrompt,
        examProfileId: profile.id,
        authToken: freshToken,
        getToken,
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

      track('chat_message_sent')

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
  }, [profile, subjects, topics, dailyLogs, messages, conversationId, isLoading, getToken, isPro, messagesUsedToday, sourcesEnabled, tutorPreferences, sessionInsights, studentModel, conversationSummaries, customSystemPrompt, subjectId, subjectName, i18n.language])

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
  }, [messages, conversationId, profile, getToken])

  const cancel = useCallback(() => {
    abortRef.current = true
    abortControllerRef.current?.abort()
  }, [])

  return {
    messages,
    isLoading,
    currentToolCall,
    streamingText,
    error,
    conversationId,
    quotaExceeded,
    messagesUsedToday,
    sendMessage,
    cancel,
    loadConversation,
    newConversation,
  }
}
