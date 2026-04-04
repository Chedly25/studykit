import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { db } from '../../db'

interface MessageFeedbackProps {
  messageIndex: number
  conversationId: string
  examProfileId: string
}

export function MessageFeedback({ messageIndex, conversationId, examProfileId }: MessageFeedbackProps) {
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')

  const submitFeedback = async (r: 'positive' | 'negative', c?: string) => {
    setRating(r)
    await db.chatFeedback.put({
      id: crypto.randomUUID(),
      messageIndex,
      conversationId,
      examProfileId,
      rating: r,
      comment: c || undefined,
      timestamp: new Date().toISOString(),
    })
  }

  const handleThumbsDown = () => {
    setShowComment(true)
    submitFeedback('negative')
  }

  const handleCommentSubmit = async () => {
    if (comment.trim()) {
      await db.chatFeedback
        .where('conversationId').equals(conversationId)
        .filter(f => f.messageIndex === messageIndex)
        .modify({ comment: comment.trim() })
    }
    setShowComment(false)
  }

  if (rating === 'positive') {
    return (
      <div className="flex items-center gap-1 mt-1">
        <ThumbsUp size={12} className="text-green-500 fill-green-500" />
        <span className="text-[10px] text-[var(--text-faint)]">Thanks!</span>
      </div>
    )
  }

  return (
    <div className="mt-1">
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {rating === null ? (
          <>
            <button
              onClick={() => submitFeedback('positive')}
              className="p-0.5 rounded hover:bg-green-500/10 text-[var(--text-faint)] hover:text-green-500 transition-colors"
              title="Good response"
            >
              <ThumbsUp size={12} />
            </button>
            <button
              onClick={handleThumbsDown}
              className="p-0.5 rounded hover:bg-red-500/10 text-[var(--text-faint)] hover:text-red-500 transition-colors"
              title="Bad response"
            >
              <ThumbsDown size={12} />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-1">
            <ThumbsDown size={12} className="text-red-500 fill-red-500" />
            <span className="text-[10px] text-[var(--text-faint)]">Thanks for the feedback</span>
          </div>
        )}
      </div>

      {showComment && (
        <div className="flex gap-1 mt-1 max-w-xs">
          <input
            autoFocus
            value={comment}
            onChange={e => setComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCommentSubmit()}
            placeholder="What was wrong? (optional)"
            className="flex-1 text-[10px] px-2 py-1 rounded bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-body)]"
          />
          <button
            onClick={handleCommentSubmit}
            className="px-2 py-1 rounded text-[10px] font-medium bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-body)]"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}
