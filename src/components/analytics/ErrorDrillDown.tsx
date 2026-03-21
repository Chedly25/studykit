/**
 * Error Drill-Down Modal — shows when a bar segment is clicked
 * in the ErrorPatternChart. Displays wrong answers + action buttons.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { X, BookOpen, Brain, ListChecks, ClipboardCheck } from 'lucide-react'
import { db } from '../../db'

interface Props {
  topicName: string
  errorType: string
  examProfileId: string
  onClose: () => void
}

const ERROR_LABELS: Record<string, string> = {
  recall: 'Recall Errors',
  conceptual: 'Conceptual Errors',
  application: 'Application Errors',
  distractor: 'Distractor Errors',
  unclassified: 'Unclassified Errors',
}

export function ErrorDrillDown({ topicName, errorType, examProfileId, onClose }: Props) {
  const navigate = useNavigate()

  const wrongAnswers = useLiveQuery(async () => {
    if (!examProfileId) return []
    const topics = await db.topics.where('examProfileId').equals(examProfileId).toArray()
    const topic = topics.find(t => t.name === topicName)
    if (!topic) return []

    const results = await db.questionResults
      .where('topicId').equals(topic.id)
      .filter(r => !r.isCorrect && (
        errorType === 'unclassified'
          ? (!r.errorType || r.errorType === null)
          : r.errorType === errorType
      ))
      .toArray()

    return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 10)
  }, [examProfileId, topicName, errorType]) ?? []

  const actions = getActionsForErrorType(errorType, topicName)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-heading)]">{topicName}</h2>
            <p className="text-sm text-[var(--text-muted)]">{ERROR_LABELS[errorType] ?? errorType}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wrong answers list */}
        {wrongAnswers.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4">No matching errors found.</p>
        ) : (
          <div className="space-y-3 mb-4">
            {wrongAnswers.map(r => (
              <div key={r.id} className="glass-card p-3 space-y-1.5">
                <p className="text-sm font-medium text-[var(--text-heading)]">{r.question}</p>
                <div className="flex gap-4 text-xs">
                  <div>
                    <span className="text-red-400 font-medium">Your answer: </span>
                    <span className="text-[var(--text-body)]">{r.userAnswer}</span>
                  </div>
                  <div>
                    <span className="text-emerald-500 font-medium">Correct: </span>
                    <span className="text-[var(--text-body)]">{r.correctAnswer}</span>
                  </div>
                </div>
                {r.explanation && (
                  <p className="text-xs text-[var(--text-muted)]">{r.explanation}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2 pt-2 border-t border-[var(--border-card)]">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Recommended Actions</p>
          {actions.map(action => (
            <button
              key={action.linkTo}
              onClick={() => { onClose(); action.linkTo === '#open-chat' ? window.dispatchEvent(new CustomEvent('open-chat-panel')) : navigate(action.linkTo) }}
              className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-[var(--bg-input)] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center shrink-0">
                {action.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-heading)]">{action.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function getActionsForErrorType(errorType: string, topicName: string) {
  const encoded = encodeURIComponent(topicName)
  switch (errorType) {
    case 'recall':
      return [
        { label: 'Review Flashcards', description: 'Strengthen memory with spaced repetition', linkTo: '/flashcard-maker', icon: <BookOpen className="w-4 h-4 text-[var(--accent-text)]" /> },
        { label: 'Study Topic', description: 'Revisit the material', linkTo: `/session?topic=${encoded}`, icon: <Brain className="w-4 h-4 text-[var(--accent-text)]" /> },
      ]
    case 'conceptual':
      return [
        { label: 'Study Theory', description: 'Deep-dive into core concepts', linkTo: `/session?topic=${encoded}`, icon: <Brain className="w-4 h-4 text-[var(--accent-text)]" /> },
        { label: 'Explain Back', description: 'Test your understanding', linkTo: '#open-chat', icon: <ClipboardCheck className="w-4 h-4 text-[var(--accent-text)]" /> },
      ]
    case 'application':
      return [
        { label: 'Practice Exercises', description: 'Apply knowledge to problems', linkTo: `/exercises?topic=${encoded}`, icon: <ListChecks className="w-4 h-4 text-[var(--accent-text)]" /> },
        { label: 'Study Topic', description: 'Review with examples', linkTo: `/session?topic=${encoded}`, icon: <Brain className="w-4 h-4 text-[var(--accent-text)]" /> },
      ]
    case 'distractor':
      return [
        { label: 'Take Quiz', description: 'Practice eliminating wrong answers', linkTo: '/practice-exam', icon: <ClipboardCheck className="w-4 h-4 text-[var(--accent-text)]" /> },
        { label: 'Review Flashcards', description: 'Clarify similar concepts', linkTo: '/flashcard-maker', icon: <BookOpen className="w-4 h-4 text-[var(--accent-text)]" /> },
      ]
    default:
      return [
        { label: 'Study Topic', description: 'General review', linkTo: `/session?topic=${encoded}`, icon: <Brain className="w-4 h-4 text-[var(--accent-text)]" /> },
      ]
  }
}
