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
 *
 * Priority order:
 * 1. Active exercise help (if on an exercise page)
 * 2. In-progress resume (if on accueil)
 * 3. Due flashcards (time-sensitive)
 * 4. Weak axes from recent exercises
 * 5. Weak topics from knowledge graph
 * 6. Try a new exercise type
 * 7. Streak at risk
 * 8. Low study time
 * 9. Default question
 */
function generateSuggestions(
  ctx: CompanionContext,
  currentPage?: string,
  currentExerciseType?: string | null,
): CompanionSuggestion[] {
  const suggestions: CompanionSuggestion[] = []
  const isExercisePage = !!currentExerciseType

  // ── 1. Active exercise: targeted help ───────────────────────────
  if (isExercisePage) {
    const typeLabels: Record<string, string> = {
      syllogisme: 'le syllogisme',
      plan: 'le plan détaillé',
      fiche: "la fiche d'arrêt",
      commentaire: "le commentaire d'arrêt",
      'cas-pratique': 'le cas pratique',
      synthese: 'la note de synthèse',
      'grand-oral': 'le Grand Oral',
    }

    // If there's an in-progress exercise of THIS type, offer targeted help
    if (ctx.inProgress && ctx.inProgress.type.replace('-', '') === currentExerciseType.replace('-', '')) {
      suggestions.push({
        id: 'exercise-help',
        label: 'Aide sur cet exercice',
        prompt: `Je suis en train de faire cet exercice : ${ctx.inProgress.type} — "${ctx.inProgress.title}". J'ai bloqué, peux-tu m'aider à avancer sans me donner la réponse ?`,
      })
    } else {
      suggestions.push({
        id: 'method-help',
        label: 'Méthode pour cet exercice',
        prompt: `Je suis sur un exercice de ${typeLabels[currentExerciseType] ?? 'cet exercice'}. Rappelle-moi les 3 points clés de la méthodologie pour bien m'y prendre.`,
      })
    }
  }

  // ── 2. Resume in-progress (only on accueil, not exercise pages) ─
  if (ctx.inProgress && currentPage === '/accueil') {
    suggestions.push({
      id: 'resume',
      label: `Reprendre : ${ctx.inProgress.title.slice(0, 30)}${ctx.inProgress.title.length > 30 ? '...' : ''}`,
      prompt: `Je veux reprendre mon exercice en cours : ${ctx.inProgress.type} — "${ctx.inProgress.title}". Donne-moi un conseil pour bien repartir.`,
    })
  }

  // ── 3. Due flashcards (time-sensitive) ──────────────────────────
  if (ctx.dueFlashcardCount > 0) {
    suggestions.push({
      id: 'flashcards',
      label: `Réviser ${ctx.dueFlashcardCount} fiche${ctx.dueFlashcardCount > 1 ? 's' : ''}`,
      prompt: "J'ai des fiches à réviser aujourd'hui. Donne-moi un conseil pour bien réviser et ancrer les connaissances.",
    })
  }

  // ── 4. Weak axes (most recent/recurring errors) ─────────────────
  if (ctx.topWeakAxes.length > 0) {
    const top = ctx.topWeakAxes[0]
    suggestions.push({
      id: 'weak-axis',
      label: `Travailler : ${top.axis.slice(0, 25)}${top.axis.length > 25 ? '...' : ''}`,
      prompt: `J'ai du mal avec "${top.axis}". Explique-moi ce point méthodologiquement et propose-moi un exercice ciblé.`,
    })
  }

  // ── 5. Weak topics from knowledge graph ─────────────────────────
  if (ctx.weakTopics.length > 0 && suggestions.length < 3) {
    const top = ctx.weakTopics[0]
    suggestions.push({
      id: 'weak-topic',
      label: `Renforcer : ${top.name.slice(0, 25)}${top.name.length > 25 ? '...' : ''}`,
      prompt: `Je peine sur le sujet "${top.name}" (maîtrise ${Math.round(top.mastery * 100)}%). Explique-moi ce point et propose-moi un exercice ciblé.`,
    })
  }

  // ── 6. Try a new exercise type ──────────────────────────────────
  const lowCountType = ctx.byType.find(t => t.count === 0)
  if (lowCountType && suggestions.length < 3) {
    suggestions.push({
      id: 'try-new',
      label: `Découvrir : ${lowCountType.type}`,
      prompt: `Je n'ai jamais fait de ${lowCountType.type}. En quoi ça consiste et comment m'y préparer ?`,
    })
  }

  // ── 7. Streak at risk ───────────────────────────────────────────
  if (ctx.daysSinceLastActivity !== null && ctx.daysSinceLastActivity >= 1 && suggestions.length < 3) {
    suggestions.push({
      id: 'streak',
      label: 'Entraînement rapide',
      prompt: "Je n'ai pas fait d'exercice aujourd'hui. Propose-moi un entraînement de 20 minutes adapté à mon niveau.",
    })
  }

  // ── 8. Low study time ───────────────────────────────────────────
  if (ctx.studyMinutesThisWeek < 60 && suggestions.length < 3) {
    suggestions.push({
      id: 'study-more',
      label: 'Motivation',
      prompt: "J'ai peu étudié cette semaine. Donne-moi un petit coup de pied pour me remotiver, sans me culpabiliser.",
    })
  }

  // ── 9. Default ──────────────────────────────────────────────────
  if (suggestions.length < 3) {
    suggestions.push({
      id: 'question',
      label: 'Poser une question de droit',
      prompt: '',
    })
  }

  return suggestions.slice(0, 3)
}
