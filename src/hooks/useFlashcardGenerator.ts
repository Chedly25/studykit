/**
 * AI-generated flashcard question from highlighted text.
 * Uses callFastModel (Haiku, Pro-only) for quick question generation.
 */
import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { callFastModel } from '../ai/fastClient'

interface GenState {
  generatedQuestion: string | null
  isGenerating: boolean
  error: string | null
}

const INITIAL: GenState = { generatedQuestion: null, isGenerating: false, error: null }

export function useFlashcardGenerator() {
  const { getToken } = useAuth()
  const [state, setState] = useState<GenState>(INITIAL)
  const cancelledRef = useRef(false)

  const generate = useCallback(async (highlightedText: string, topicName?: string) => {
    if (!highlightedText.trim()) return
    cancelledRef.current = false
    setState({ ...INITIAL, isGenerating: true })

    try {
      const token = await getToken()
      if (!token || cancelledRef.current) {
        setState(INITIAL)
        return
      }

      const topicCtx = topicName ? `\nTopic context: ${topicName}` : ''
      const prompt = `Generate a single clear, testable question whose answer is the passage below. The question should test understanding, not just word-for-word recall. Respond with ONLY the question text, nothing else.${topicCtx}

"${highlightedText.slice(0, 1000)}"`

      const text = await callFastModel(
        prompt,
        'You create study flashcard questions. Be concise and specific.',
        token,
        { maxTokens: 128 },
      )
      if (cancelledRef.current) return

      const question = text.trim().replace(/^["']|["']$/g, '')
      setState({ generatedQuestion: question, isGenerating: false, error: null })
    } catch {
      if (cancelledRef.current) return
      setState({ generatedQuestion: null, isGenerating: false, error: 'Generation failed' })
    }
  }, [getToken])

  const reset = useCallback(() => {
    cancelledRef.current = true
    setState(INITIAL)
  }, [])

  return { ...state, generate, reset }
}
