/**
 * Inline action types — a discriminated union of structured actions
 * that can be dispatched inline from any surface (session, reader, dashboard).
 *
 * These replace the old "chat-as-action" pattern where buttons would dump
 * prompts into a chat input. Each action type corresponds to a dedicated
 * component under src/components/actions/ that renders a structured widget.
 */

export interface QuizHighlightData {
  text: string
  pageNumber: number
}

export type InlineAction =
  | {
      type: 'explain-topic'
      topicId: string
      topicName: string
      level?: 'basics' | 'deep'
    }
  | {
      type: 'quiz-topic'
      topicId: string
      topicName: string
      difficulty?: 'easy' | 'medium' | 'hard'
    }
  | {
      type: 'quiz-concept-card'
      cardId: string
      cardTitle: string
      topicId: string
    }
  | {
      type: 'quiz-highlights'
      highlights: QuizHighlightData[]
      documentTitle: string
      documentId: string
    }
  | {
      type: 'quiz-recall'
      pages: [number, number]
      documentTitle: string
      documentId: string
    }
  | {
      type: 'common-mistakes'
      topicId: string
      topicName: string
    }
  | {
      type: 'review-flashcards'
      topicId?: string
      count?: number
    }
  | {
      type: 'explain-exercise'
      exerciseId: string
      exerciseText: string
      topicName: string
      solutionText?: string
    }

/** Extract the type string of an InlineAction. */
export type InlineActionType = InlineAction['type']
