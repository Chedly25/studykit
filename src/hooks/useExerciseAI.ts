/**
 * Single-shot AI grading for exercise answers.
 * Lightweight alternative to the full agent loop — no tool calls, just grade and respond.
 */
import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { streamChat, QuotaExceededError } from '../ai/client'
import { logQuestionResult } from '../ai/tools/dataOperations'
import { db } from '../db'
import type { Exercise } from '../db/schema'

interface ExerciseAIState {
  feedback: string
  score: number | null
  errorType: string | null
  isStreaming: boolean
  error: string | null
  quotaExceeded: boolean
}

const INITIAL_STATE: ExerciseAIState = {
  feedback: '',
  score: null,
  errorType: null,
  isStreaming: false,
  error: null,
  quotaExceeded: false,
}

function buildGradingPrompt(exercise: Exercise, userAnswer: string, topicNames: string[]): string {
  return `You are an expert academic tutor grading a student's answer to an exercise.

## Exercise
${exercise.text}

## Student's Answer
${userAnswer}

${exercise.solutionText ? `## Reference Solution\n${exercise.solutionText}\n` : ''}
## Topics
${topicNames.join(', ')}

## Instructions
Grade the student's answer. Respond with a JSON block followed by detailed feedback.

First, output EXACTLY this JSON block (no markdown code fences):
{"score": <0-100>, "errorType": "<recall|conceptual|application|null>"}

Then provide detailed feedback:
1. What was correct in the student's answer
2. What was incorrect or missing
3. The correct approach with explanation
4. Key concepts to review if the answer was wrong

Use LaTeX notation (\\( ... \\) for inline, \\[ ... \\] for display) for any mathematical expressions.`
}

function parseGradingResponse(text: string): { score: number | null; errorType: string | null } {
  // Try to find JSON at the start of the response
  const jsonMatch = text.match(/\{[\s]*"score"[\s]*:[\s]*(\d+)[\s]*,[\s]*"errorType"[\s]*:[\s]*"([^"]*)"[\s]*\}/)
  if (jsonMatch) {
    return {
      score: parseInt(jsonMatch[1], 10),
      errorType: jsonMatch[2] === 'null' ? null : jsonMatch[2],
    }
  }
  return { score: null, errorType: null }
}

export function useExerciseAI(examProfileId: string | undefined) {
  const { getToken } = useAuth()
  const [state, setState] = useState<ExerciseAIState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)

  const checkAnswer = useCallback(async (
    exercise: Exercise,
    userAnswer: string,
    topicNames: string[],
  ) => {
    if (!examProfileId || !userAnswer.trim()) return

    // Abort any previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({ ...INITIAL_STATE, isStreaming: true })

    try {
      const authToken = await getToken() ?? undefined

      const systemPrompt = buildGradingPrompt(exercise, userAnswer, topicNames)

      let fullText = ''
      const response = await streamChat({
        messages: [{ role: 'user', content: 'Grade my answer to this exercise.' }],
        system: systemPrompt,
        tools: [],
        maxTokens: 2048,
        authToken,
        signal: controller.signal,
        onToken: (token) => {
          fullText += token
          // Extract feedback (everything after the JSON line)
          const jsonEnd = fullText.indexOf('}')
          const feedbackPart = jsonEnd >= 0 ? fullText.slice(jsonEnd + 1).trim() : ''
          setState(prev => ({ ...prev, feedback: feedbackPart }))
        },
      })

      // Parse final response
      const textContent = response.content.find(c => c.type === 'text')
      const finalText = textContent && 'text' in textContent ? textContent.text : fullText
      const { score, errorType } = parseGradingResponse(finalText)

      // Extract feedback (everything after the JSON block)
      const jsonEnd = finalText.indexOf('}')
      const feedbackText = jsonEnd >= 0 ? finalText.slice(jsonEnd + 1).trim() : finalText

      setState({
        feedback: feedbackText,
        score,
        errorType,
        isStreaming: false,
        error: null,
        quotaExceeded: false,
      })

      // Update exercise record (status, score, attempt count)
      if (score !== null) {
        const normalizedScore = score / 100
        const existingExercise = await db.exercises.get(exercise.id)
        if (existingExercise) {
          await db.exercises.update(exercise.id, {
            status: normalizedScore >= 0.7 ? 'completed' : 'attempted',
            lastAttemptScore: normalizedScore,
            attemptCount: existingExercise.attemptCount + 1,
          })
        }

        // Also record as ExerciseAttempt
        await db.exerciseAttempts.put({
          id: crypto.randomUUID(),
          exerciseId: exercise.id,
          examProfileId,
          score: normalizedScore,
          feedback: feedbackText.slice(0, 2000),
          createdAt: new Date().toISOString(),
        })

        // Update mastery for each topic
        for (const topicName of topicNames) {
          await logQuestionResult(examProfileId, {
            topicName,
            question: exercise.text.slice(0, 200),
            userAnswer: userAnswer.slice(0, 500),
            correctAnswer: exercise.solutionText?.slice(0, 500) ?? 'See AI feedback',
            isCorrect: score >= 60,
            difficulty: exercise.difficulty,
            errorType: errorType ?? undefined,
          })
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return

      if (err instanceof QuotaExceededError) {
        setState(prev => ({ ...prev, isStreaming: false, quotaExceeded: true, error: 'Daily quota exceeded. Upgrade to Pro for more.' }))
      } else {
        setState(prev => ({ ...prev, isStreaming: false, error: err instanceof Error ? err.message : 'Failed to check answer' }))
      }
    }
  }, [examProfileId, getToken])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(INITIAL_STATE)
  }, [])

  return { ...state, checkAnswer, reset }
}
