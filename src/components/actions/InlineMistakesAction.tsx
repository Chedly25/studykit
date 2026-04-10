/**
 * Inline action: show common mistakes for a topic.
 *
 * Queries past questionResults for the topic, filters wrong answers, and
 * asks the LLM to summarize recurring error patterns in plain language.
 * The prompt is tuned to abstract patterns from examples rather than listing
 * individual errors, and to refuse to invent patterns when the evidence is thin.
 */
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { db } from '../../db'
import { useExamProfile } from '../../hooks/useExamProfile'
import { streamChat } from '../../ai/client'
import { getCachedResponse, setCachedResponse } from '../../lib/sessionCache'
import { MathText } from '../MathText'

interface Props {
  topicId: string
  topicName: string
  onClose: () => void
}

const MAX_WRONG_ANSWERS = 20

export function InlineMistakesAction({ topicId, topicName, onClose }: Props) {
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { getToken } = useAuth()
  const [summary, setSummary] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load recent wrong answers for this topic
  const wrongAnswers = useLiveQuery(async () => {
    if (!profileId) return []
    const results = await db.questionResults
      .where('topicId').equals(topicId)
      .filter(r => !r.isCorrect)
      .toArray()
    return results
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, MAX_WRONG_ANSWERS)
  }, [profileId, topicId]) ?? []

  useEffect(() => {
    if (wrongAnswers.length === 0) {
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      try {
        // Cache keyed by topic + wrong answer count + latest timestamp
        const cacheKey = ['inline-mistakes', topicId, String(wrongAnswers.length), wrongAnswers[0]?.timestamp ?? '']
        const cached = getCachedResponse(cacheKey)
        if (cached) {
          setSummary(cached)
          setIsLoading(false)
          return
        }

        const token = await getToken()
        if (!token || controller.signal.aborted) return

        const wrongList = wrongAnswers
          .map((r, i) => {
            const errorTypeTag = r.errorType ? ` [${r.errorType}]` : ''
            return `${i + 1}.${errorTypeTag} Question: ${r.question}\n   Your answer: ${r.userAnswer}\n   Correct answer: ${r.correctAnswer}${r.explanation ? `\n   Explanation: ${r.explanation}` : ''}`
          })
          .join('\n\n')

        // Goal: find recurring patterns, not just list errors.
        // Must distinguish surface errors from conceptual misunderstandings.
        const prompt = `You are analyzing a student's wrong answers on the topic "${topicName}" to identify COMMON MISTAKE PATTERNS they can learn from.

Here are their recent wrong answers (most recent first):

${wrongList}

Write a 3-5 sentence analysis that:
1. Identifies the TOP 1-2 recurring mistake patterns (not a list of individual errors)
2. Explains WHY the student is making these mistakes (misconception, skipped step, confusion between two concepts, etc.)
3. Gives ONE concrete, actionable tip to fix the most important pattern

Rules:
- Do not repeat the questions verbatim. Abstract the pattern.
- If there's only one mistake or no clear pattern, say so honestly — do not invent patterns.
- Use LaTeX $...$ for math if relevant.
- Never use emojis.
- Match the language of the questions (English or French).
- Be specific to the actual errors shown, not generic study advice.`

        let text = ''
        await streamChat({
          messages: [{ id: crypto.randomUUID(), role: 'user', content: prompt }],
          system: 'You are a study coach who identifies mistake patterns in student work. Be specific, abstract patterns from examples, and give actionable advice. Never invent patterns that aren\'t supported by the evidence.',
          tools: [],
          maxTokens: 768,
          authToken: token,
          onToken: (t) => { text += t; setSummary(text) },
          signal: controller.signal,
        })

        if (text) {
          setCachedResponse(cacheKey, text)
        }
        setIsLoading(false)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to analyze mistakes. Try again.')
          setIsLoading(false)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [topicId, topicName, wrongAnswers, getToken])

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-semibold text-[var(--text-heading)]">
            Common mistakes: {topicName}
          </p>
        </div>
        <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)]">
          <X className="w-4 h-4" />
        </button>
      </div>

      {wrongAnswers.length === 0 && !isLoading && (
        <p className="text-sm text-[var(--text-muted)] py-2">
          No wrong answers recorded yet for this topic. Practice some questions first to see patterns.
        </p>
      )}

      {isLoading && wrongAnswers.length > 0 && summary === '' && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Analyzing {wrongAnswers.length} past mistakes...</span>
        </div>
      )}

      {summary && (
        <div className="text-sm text-[var(--text-body)] leading-relaxed">
          <MathText>{summary}</MathText>
        </div>
      )}

      {error && (
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      )}
    </div>
  )
}
