/**
 * Streams a brief AI explanation inline after a bad rating.
 * Self-contained: starts streaming on mount, aborts on unmount.
 */
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Sparkles, Loader2, X, Bookmark, Check } from 'lucide-react'
import { toast } from 'sonner'
import { streamChat } from '../../ai/client'
import { db } from '../../db'
import { MathText } from '../MathText'

interface Props {
  content: string
  topicName: string
  onDismiss: () => void
  examProfileId?: string
  topicId?: string
}

export function InlineAIExplanation({ content, topicName, onDismiss, examProfileId, topicId }: Props) {
  const { getToken } = useAuth()
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(true)
  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      try {
        const token = await getToken()
        if (!token || controller.signal.aborted) return

        let accumulated = ''
        await streamChat({
          messages: [{
            role: 'user',
            content: `Explain this briefly and clearly (2-4 sentences). Topic: ${topicName}\n\nContent:\n${content}`,
          }],
          system: 'You are a study tutor. Give a brief, clear explanation in 2-4 sentences. Be specific to the content provided. If there\'s math, use LaTeX $...$. Do not repeat the question — go straight to the explanation.',
          tools: [],
          authToken: token,
          onToken: (t) => {
            accumulated += t
            setText(accumulated)
          },
          signal: controller.signal,
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(true)
        }
      } finally {
        setIsStreaming(false)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [content, topicName, getToken])

  const handleSave = async () => {
    if (!examProfileId || saved) return
    try {
      let deck = await db.flashcardDecks.where('examProfileId').equals(examProfileId)
        .filter(d => d.name === 'AI Explanations').first()
      if (!deck) {
        const deckId = crypto.randomUUID()
        deck = {
          id: deckId,
          examProfileId,
          topicId,
          name: 'AI Explanations',
          createdAt: new Date().toISOString(),
        }
        await db.flashcardDecks.put(deck)
      }
      await db.flashcards.put({
        id: crypto.randomUUID(),
        deckId: deck.id,
        topicId,
        front: content,
        back: text,
        source: 'ai-generated',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: new Date().toISOString().slice(0, 10),
        lastRating: 0,
      })
      setSaved(true)
      toast.success('Saved as flashcard')
    } catch {
      toast.error('Failed to save')
    }
  }

  if (error) return null

  return (
    <div className="mt-3 p-3 rounded-lg bg-[var(--accent-bg)]/30 border border-[var(--accent-text)]/10 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
          <span className="text-xs font-medium text-[var(--accent-text)]">AI Explanation</span>
          {isStreaming && <Loader2 className="w-3 h-3 text-[var(--accent-text)] animate-spin" />}
        </div>
        <button onClick={onDismiss} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-body)]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {text ? (
        <p className="text-sm text-[var(--text-body)] leading-relaxed">
          <MathText>{text}</MathText>
        </p>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">Thinking...</p>
      )}
      {!isStreaming && text && (
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={onDismiss}
            className="text-xs font-medium text-[var(--accent-text)] hover:underline"
          >
            Got it — continue
          </button>
          {examProfileId && !saved && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-text)]"
            >
              <Bookmark className="w-3 h-3" /> Save as flashcard
            </button>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
      )}
    </div>
  )
}
