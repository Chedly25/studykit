/**
 * InlineActionContainer — a slot that renders any structured action inline.
 *
 * Different surfaces (StudySession, DocumentReader, TopicDetailPanel) mount
 * their own container via the `useInlineAction` hook. The container is a
 * thin discriminated-union switch over action types — no global state, no
 * registry pattern.
 *
 * Wrapped in React.memo because parent re-renders (e.g. StudySession during
 * chat streaming) would otherwise re-create inline object literals passed to
 * child components, causing useEffect dependencies to re-fire and abort
 * in-flight API calls.
 */
import { memo } from 'react'
import type { InlineAction } from './types'
import { InlineExplainAction } from './InlineExplainAction'
import { InlineQuizAction } from './InlineQuizAction'
import { InlineMistakesAction } from './InlineMistakesAction'
import { InlineReviewAction } from './InlineReviewAction'
import { InlineExerciseExplainAction } from './InlineExerciseExplainAction'

interface Props {
  action: InlineAction
  onClose: () => void
}

export const InlineActionContainer = memo(function InlineActionContainer({ action, onClose }: Props) {
  switch (action.type) {
    case 'explain-topic':
      return (
        <InlineExplainAction
          topicId={action.topicId}
          topicName={action.topicName}
          level={action.level}
          onClose={onClose}
        />
      )

    case 'quiz-topic':
      return (
        <InlineQuizAction
          source={{
            kind: 'topic',
            topicId: action.topicId,
            topicName: action.topicName,
            difficulty: action.difficulty ?? 'medium',
          }}
          onClose={onClose}
        />
      )

    case 'quiz-concept-card':
      return (
        <InlineQuizAction
          source={{
            kind: 'concept-card',
            cardId: action.cardId,
            cardTitle: action.cardTitle,
            topicId: action.topicId,
          }}
          onClose={onClose}
        />
      )

    case 'quiz-highlights':
      return (
        <InlineQuizAction
          source={{
            kind: 'highlights',
            highlights: action.highlights,
            documentTitle: action.documentTitle,
          }}
          onClose={onClose}
        />
      )

    case 'quiz-recall':
      return (
        <InlineQuizAction
          source={{
            kind: 'recall',
            pages: action.pages,
            documentTitle: action.documentTitle,
            documentId: action.documentId,
          }}
          onClose={onClose}
        />
      )

    case 'common-mistakes':
      return (
        <InlineMistakesAction
          topicId={action.topicId}
          topicName={action.topicName}
          onClose={onClose}
        />
      )

    case 'review-flashcards':
      return (
        <InlineReviewAction
          topicId={action.topicId}
          onClose={onClose}
        />
      )

    case 'explain-exercise':
      return (
        <InlineExerciseExplainAction
          exerciseId={action.exerciseId}
          exerciseText={action.exerciseText}
          topicName={action.topicName}
          solutionText={action.solutionText}
          onClose={onClose}
        />
      )
  }
})
