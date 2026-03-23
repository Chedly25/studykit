/**
 * AI answer evaluation for flashcards and concept quizzes.
 * Uses callFastModel (Claude Haiku, Pro-only) for quick scoring.
 */
import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { callFastModel } from '../ai/fastClient'
import { getCachedResponse, setCachedResponse } from '../lib/sessionCache'

interface EvalState {
  quality: number | null
  feedback: string
  isEvaluating: boolean
  error: string | null
}

const INITIAL: EvalState = { quality: null, feedback: '', isEvaluating: false, error: null }

function parseEvalResponse(text: string): { quality: number | null; feedback: string } {
  const jsonMatch = text.match(/\{[\s]*"quality"[\s]*:[\s]*(\d)[\s]*,[\s]*"feedback"[\s]*:[\s]*"([^"]*)"[\s]*\}/)
  if (jsonMatch) {
    const q = parseInt(jsonMatch[1], 10)
    return { quality: Math.max(1, Math.min(5, q)), feedback: jsonMatch[2] }
  }
  // Fallback: try to find just a number
  const numMatch = text.match(/\b([1-5])\b/)
  return { quality: numMatch ? parseInt(numMatch[1], 10) : null, feedback: text.slice(0, 200) }
}

export function useAnswerEvaluator(examProfileId?: string) {
  const { getToken } = useAuth()
  const [state, setState] = useState<EvalState>(INITIAL)
  const cancelledRef = useRef(false)

  const evaluate = useCallback(async (
    question: string,
    expectedAnswer: string,
    studentAnswer: string,
    topicName: string,
  ) => {
    if (!examProfileId || !studentAnswer.trim()) return
    cancelledRef.current = false
    setState({ ...INITIAL, isEvaluating: true })

    try {
      // Check cache first
      const cacheKey = ['eval', question, expectedAnswer, studentAnswer]
      const cached = getCachedResponse(cacheKey)
      if (cached) {
        const { quality, feedback } = parseEvalResponse(cached)
        setState({ quality, feedback, isEvaluating: false, error: null })
        return
      }

      const token = await getToken()
      if (!token || cancelledRef.current) return

      const prompt = `Rate this student's answer on a scale of 1-5 and give 1-sentence feedback.

1 = completely wrong or blank
2 = shows awareness but major gaps
3 = partially correct, key elements missing
4 = mostly correct with minor gaps
5 = fully correct

Topic: ${topicName}
Question: ${question}
Expected answer: ${expectedAnswer}
Student's answer: ${studentAnswer}

Reply with ONLY this JSON (no markdown, no code fences):
{"quality": <1-5>, "feedback": "<1 sentence>"}`

      const text = await callFastModel(prompt, 'You are a strict but fair academic evaluator. Be concise. Never use emojis.', token, { maxTokens: 256 })
      if (cancelledRef.current) return

      setCachedResponse(cacheKey, text)
      const { quality, feedback } = parseEvalResponse(text)
      setState({ quality, feedback, isEvaluating: false, error: null })
    } catch (err) {
      if (cancelledRef.current) return
      setState({ quality: null, feedback: '', isEvaluating: false, error: err instanceof Error ? err.message : 'Evaluation failed' })
    }
  }, [examProfileId, getToken])

  const reset = useCallback(() => {
    cancelledRef.current = true
    setState(INITIAL)
  }, [])

  return { ...state, evaluate, reset }
}
