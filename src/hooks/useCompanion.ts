/**
 * useCompanion — manages the CRFPA companion conversation.
 *
 * - Maintains a dedicated companion conversation (persists across sessions)
 * - Loads aggregated exercise history as context
 * - Builds the répétiteur system prompt on every message
 * - Generates proactive suggestions based on current page + context
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useUser } from '@clerk/clerk-react'
import { runAgentLoop } from '../ai/agentLoop'
import { buildCompanionPrompt } from '../ai/prompts/companionPrompt'
import { buildCompanionContext, type CompanionContext } from '../ai/companionContext'
import {
  createConversation,
  loadMessages,
  saveMessages,
} from '../ai/messageStore'
import type { Message } from '../ai/types'

const COMPANION_CONVERSATION_SUFFIX = ':companion'

export interface CompanionSuggestion {
  id: string
  label: string
  prompt: string
}

interface UseCompanionOptions {
  examProfileId: string | undefined
  currentPage?: string
  currentExerciseType?: 'syllogisme' | 'plan' | 'fiche' | 'commentaire' | 'cas-pratique' | 'synthese' | 'grand-oral' | null
  currentExerciseTask?: string
}

export function useCompanion(options: UseCompanionOptions) {
  const { examProfileId, currentPage, currentExerciseType, currentExerciseTask } = options
  const { getToken } = useAuth()
  const { user } = useUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<CompanionContext | null>(null)
  const [suggestions, setSuggestions] = useState<CompanionSuggestion[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const isLoadingRef = useRef(false)

  // Load companion context when profile changes
  useEffect(() => {
    if (!examProfileId) return
    let cancelled = false
    buildCompanionContext(examProfileId).then(ctx => {
      if (!cancelled) setContext(ctx)
    })
    return () => { cancelled = true }
  }, [examProfileId])

  // Load or create companion conversation
  useEffect(() => {
    if (!examProfileId) return
    let cancelled = false
    const convId = `${examProfileId}${COMPANION_CONVERSATION_SUFFIX}`
    loadMessages(convId).then(msgs => {
      if (!cancelled) setMessages(msgs)
    }).catch(() => {
      // Conversation doesn't exist yet — create on first message
    })
    return () => { cancelled = true }
  }, [examProfileId])

  // Generate proactive suggestions when context or page changes
  useEffect(() => {
    if (!context) return
    const newSuggestions = generateSuggestions(context, currentPage, currentExerciseType)
    setSuggestions(newSuggestions)
  }, [context, currentPage, currentExerciseType])

  const sendMessage = useCallback(async (text: string) => {
    if (!examProfileId || !context || isLoadingRef.current) return

    setError(null)
    setIsLoading(true)
    isLoadingRef.current = true
    setStreamingText('')

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const token = await getToken()
      if (!token) {
        setError('Authentification requise')
        return
      }

      // Ensure conversation exists
      const convId = `${examProfileId}${COMPANION_CONVERSATION_SUFFIX}`
      let msgs = [...messages]
      if (msgs.length === 0) {
        await createConversation(examProfileId, 'Le Prof', convId)
      }

      // Build system prompt with fresh context
      const systemPrompt = buildCompanionPrompt({
        studentName: user?.firstName,
        context,
        currentPage,
        currentExerciseType,
        currentExerciseTask,
      })

      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
      msgs = [...msgs, userMsg]
      setMessages(msgs)

      const result = await runAgentLoop({
        messages: msgs,
        systemPrompt,
        examProfileId,
        authToken: token,
        getToken: async () => getToken(),
        onToken: (t) => setStreamingText(prev => prev + t),
        signal: abort.signal,
      })

      setMessages(result.messages)
      setStreamingText('')
      await saveMessages(convId, result.messages)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Erreur inattendue')
      }
    } finally {
      setIsLoading(false)
      isLoadingRef.current = false
    }
  }, [examProfileId, context, messages, currentPage, currentExerciseType, currentExerciseTask, getToken, user?.firstName])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearConversation = useCallback(async () => {
    if (!examProfileId) return
    const convId = `${examProfileId}${COMPANION_CONVERSATION_SUFFIX}`
    setMessages([])
    setStreamingText('')
    setError(null)
    // Re-create the conversation empty with the same ID
    await createConversation(examProfileId, 'Le Prof', convId)
  }, [examProfileId])

  return {
    messages,
    isLoading,
    streamingText,
    error,
    suggestions,
    context,
    sendMessage,
    cancel,
    clearConversation,
  }
}

/**
 * Generate 3 contextual suggestions based on the student's state.
 */
function generateSuggestions(
  ctx: CompanionContext,
  currentPage?: string,
  currentExerciseType?: string | null,
): CompanionSuggestion[] {
  const suggestions: CompanionSuggestion[] = []

  // If there's work in progress, suggest resuming
  if (ctx.inProgress && currentPage === '/accueil') {
    suggestions.push({
      id: 'resume',
      label: `Reprendre mon ${ctx.inProgress.type}`,
      prompt: `Je veux reprendre mon exercice en cours : ${ctx.inProgress.type} — "${ctx.inProgress.title}". Donne-moi un conseil pour bien repartir.`,
    })
  }

  // If on an exercise page and no in-progress, suggest help for this exercise type
  if (currentExerciseType && !ctx.inProgress) {
    const typeLabels: Record<string, string> = {
      syllogisme: 'le syllogisme',
      plan: 'le plan détaillé',
      fiche: "la fiche d'arrêt",
      commentaire: "le commentaire d'arrêt",
      'cas-pratique': 'le cas pratique',
      synthese: 'la note de synthèse',
      'grand-oral': 'le Grand Oral',
    }
    suggestions.push({
      id: 'method-help',
      label: 'Méthode pour cet exercice',
      prompt: `Explique-moi la méthodologie du ${typeLabels[currentExerciseType] ?? 'cet exercice'} en 3 points clés.`,
    })
  }

  // If there are weak axes, suggest working on the top one
  if (ctx.topWeakAxes.length > 0) {
    const top = ctx.topWeakAxes[0]
    suggestions.push({
      id: 'weak-axis',
      label: `Travailler : ${top.axis}`,
      prompt: `J'ai du mal avec "${top.axis}". Explique-moi ce point méthodologiquement et propose-moi un exercice ciblé.`,
    })
  }

  // If no weak axes but low count on a type, suggest trying a new type
  const lowCountType = ctx.byType.find(t => t.count === 0)
  if (lowCountType && suggestions.length < 3) {
    suggestions.push({
      id: 'try-new',
      label: `Essayer : ${lowCountType.type}`,
      prompt: `Je n'ai jamais fait de ${lowCountType.type}. En quoi ça consiste et comment m'y préparer ?`,
    })
  }

  // If streak is at risk, suggest practicing
  if (ctx.daysSinceLastActivity !== null && ctx.daysSinceLastActivity >= 1 && suggestions.length < 3) {
    suggestions.push({
      id: 'streak',
      label: 'Entraînement rapide',
      prompt: "Je n'ai pas fait d'exercice aujourd'hui. Propose-moi un entraînement de 20 minutes adapté à mon niveau.",
    })
  }

  // Default: general legal question
  if (suggestions.length < 3) {
    suggestions.push({
      id: 'question',
      label: 'Poser une question de droit',
      prompt: '', // Empty means user will type
    })
  }

  return suggestions.slice(0, 3)
}
