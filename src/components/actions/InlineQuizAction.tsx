/**
 * Inline action: quiz the student on a topic, concept card, highlights, or a recall range.
 *
 * Generates questions via a direct LLM call (not via the chat agentLoop), then
 * renders them in the refactored InlineQuiz widget.
 *
 * NOTE: This component uses a quiz-generation prompt that mirrors the
 * existing `renderQuiz` tool's expectations (MCQ with 4 options, correctIndex,
 * explanation). If the generated quiz quality needs iteration, the prompt
 * can be tuned in this file alone.
 */
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Loader2, AlertCircle } from 'lucide-react'
import { streamChat } from '../../ai/client'
import { db } from '../../db'
import { InlineQuiz, type QuizQuestion } from '../chat/InlineQuiz'
import type { QuizHighlightData } from './types'

type QuizSource =
  | { kind: 'topic'; topicId: string; topicName: string; difficulty: 'easy' | 'medium' | 'hard' }
  | { kind: 'concept-card'; cardId: string; cardTitle: string; topicId: string }
  | { kind: 'highlights'; highlights: QuizHighlightData[]; documentTitle: string }
  | { kind: 'recall'; pages: [number, number]; documentTitle: string; documentId: string }

interface Props {
  source: QuizSource
  onClose: () => void
}

export function InlineQuizAction({ source, onClose }: Props) {
  const { getToken } = useAuth()
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // For concept-card source: load the card content
  const conceptCard = useLiveQuery(
    () => source.kind === 'concept-card' ? db.conceptCards.get(source.cardId) : undefined,
    [source.kind === 'concept-card' ? source.cardId : null],
  )

  // For recall source: load document chunks in the page range
  const recallChunks = useLiveQuery(
    async () => {
      if (source.kind !== 'recall') return null
      const chunks = await db.documentChunks
        .where('documentId').equals(source.documentId)
        .filter(c => c.pageNumber !== undefined && c.pageNumber >= source.pages[0] && c.pageNumber <= source.pages[1])
        .toArray()
      return chunks.map(c => c.content).join('\n\n').slice(0, 4000)
    },
    [source.kind === 'recall' ? source.documentId : null, source.kind === 'recall' ? source.pages.join('-') : null],
  )

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
    setError(null)
    setQuestions(null)

    ;(async () => {
      try {
        const token = await getToken()
        if (!token || controller.signal.aborted) return

        // Build context and prompt based on source kind
        let context: string
        let label: string
        let count = 5

        if (source.kind === 'topic') {
          context = `Topic: ${source.topicName}\nDifficulty: ${source.difficulty}`
          label = `${source.topicName}`
        } else if (source.kind === 'concept-card') {
          if (!conceptCard) return // wait for data
          const keyPoints = (() => {
            try { return (JSON.parse(conceptCard.keyPoints) as string[]).join('\n- ') } catch { return '' }
          })()
          context = `Concept: ${conceptCard.title}\n\nKey points:\n- ${keyPoints}\n\n${conceptCard.example ? `Example: ${conceptCard.example}` : ''}`
          label = conceptCard.title
        } else if (source.kind === 'highlights') {
          const highlightText = source.highlights
            .slice(0, 20)
            .map((h, i) => `${i + 1}. (p.${h.pageNumber}) "${h.text.slice(0, 300)}"`)
            .join('\n')
          context = `Document: ${source.documentTitle}\n\nHighlighted passages:\n${highlightText}`
          label = `highlights from ${source.documentTitle}`
          count = Math.min(5, Math.max(3, Math.ceil(source.highlights.length / 4)))
        } else {
          // recall
          if (recallChunks === undefined) return // wait for data
          if (!recallChunks || recallChunks.length === 0) {
            setError('No text found for those pages to generate a quiz from.')
            setIsLoading(false)
            return
          }
          context = `Document: ${source.documentTitle}\nPages ${source.pages[0]}–${source.pages[1]} content:\n\n${recallChunks}`
          label = `pages ${source.pages[0]}–${source.pages[1]} of ${source.documentTitle}`
          count = 2
        }

        const prompt = `Generate ${count} multiple-choice questions to test understanding of ${label}.

Context:
${context}

Return ONLY valid JSON in this exact shape (no markdown, no prose, no comments):
{
  "questions": [
    {
      "question": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why the correct answer is correct, 1-2 sentences"
    }
  ]
}

Rules:
- Exactly 4 options per question
- correctIndex is 0-indexed (0 to 3)
- Questions should test understanding, not pure recall when possible
- Distractors should be plausible
- If the context includes math, use LaTeX with $...$ delimiters
- Match the language of the provided context (English or French)`

        const response = await streamChat({
          messages: [{ id: crypto.randomUUID(), role: 'user', content: prompt }],
          system: 'You are a study quiz generator. Always return valid JSON matching the requested schema. Never include markdown fences or extra prose.',
          tools: [],
          authToken: token,
          maxTokens: 2048,
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        const text = response.content
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
          .map(c => c.text)
          .join('')
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')

        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          setError('Failed to generate quiz. Try again.')
          setIsLoading(false)
          return
        }

        const parsed = JSON.parse(jsonMatch[0]) as { questions: QuizQuestion[] }
        const valid = (parsed.questions ?? []).filter(q =>
          q.question && Array.isArray(q.options) && q.options.length >= 2 &&
          typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < q.options.length
        )

        if (valid.length === 0) {
          setError('Quiz generation returned no valid questions. Try again.')
          setIsLoading(false)
          return
        }

        setQuestions(valid)
        setIsLoading(false)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to generate quiz. Try again.')
          setIsLoading(false)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [source, getToken, conceptCard, recallChunks])

  const headerLabel = (() => {
    if (source.kind === 'topic') return `Quiz: ${source.topicName}`
    if (source.kind === 'concept-card') return `Quiz: ${source.cardTitle}`
    if (source.kind === 'highlights') return `Quiz: highlights from ${source.documentTitle}`
    return `Recall check: pages ${source.pages[0]}–${source.pages[1]}`
  })()

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[var(--text-heading)]">{headerLabel}</p>
        <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)]">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Generating questions...</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {questions && !isLoading && !error && (
        <InlineQuiz questions={questions} />
      )}
    </div>
  )
}
