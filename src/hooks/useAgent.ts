import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { runAgentLoop } from '../ai/agentLoop'
import { buildSystemPrompt, buildSocraticPrompt } from '../ai/systemPrompt'
import { createConversation, loadMessages, saveMessages } from '../ai/messageStore'
import type { Message } from '../ai/types'
import type { ExamProfile, Subject, Topic, DailyStudyLog, Assignment } from '../db/schema'
import { db } from '../db'

interface UseAgentOptions {
  profile: ExamProfile | undefined
  subjects: Subject[]
  topics: Topic[]
  dailyLogs: DailyStudyLog[]
}

export function useAgent(options: UseAgentOptions) {
  const { profile, subjects, topics, dailyLogs } = options
  const { getToken } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentToolCall, setCurrentToolCall] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isSocratic, setIsSocratic] = useState(false)
  const [socraticTopic, setSocraticTopic] = useState<string>('')
  const abortRef = useRef(false)

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!profile || isLoading) return

    setError(null)
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

      const ctx = {
        profile,
        subjects,
        topics,
        dailyLogs,
        dueFlashcardCount,
        upcomingAssignments: upcomingAssignments.slice(0, 5),
      }

      const systemPrompt = isSocratic && socraticTopic
        ? buildSocraticPrompt(ctx, socraticTopic)
        : buildSystemPrompt(ctx)

      // Get auth token for API requests
      const authToken = await getToken() ?? undefined

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [profile, subjects, topics, dailyLogs, messages, conversationId, isLoading, isSocratic, socraticTopic, getToken])

  const loadConversation = useCallback(async (convId: string) => {
    const msgs = await loadMessages(convId)
    setMessages(msgs)
    setConversationId(convId)
  }, [])

  const newConversation = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setStreamingText('')
    setError(null)
    setIsSocratic(false)
    setSocraticTopic('')
  }, [])

  const startSocraticMode = useCallback((topicName: string) => {
    setIsSocratic(true)
    setSocraticTopic(topicName)
    newConversation()
  }, [newConversation])

  return {
    messages,
    isLoading,
    currentToolCall,
    streamingText,
    error,
    conversationId,
    isSocratic,
    sendMessage,
    loadConversation,
    newConversation,
    startSocraticMode,
  }
}
