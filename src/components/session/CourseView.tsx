import { Link } from 'react-router-dom'
import { FileText, ExternalLink, BookOpen, Layers, Upload } from 'lucide-react'
import { useTopicDetail } from '../../hooks/useTopicDetail'
import { SkeletonLine, SkeletonBlock } from '../Skeleton'
import { MathText } from '../MathText'

interface CourseViewProps {
  examProfileId: string
  topicId: string
  topicName: string
}

export function CourseView({ examProfileId, topicId, topicName }: CourseViewProps) {
  const detail = useTopicDetail(topicId, examProfileId)

  if (detail.isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[960px] mx-auto space-y-4">
          <SkeletonLine width="w-48" />
          <SkeletonBlock height="h-24" />
          <SkeletonLine width="w-32" />
          <SkeletonBlock height="h-16" />
        </div>
      </div>
    )
  }

  const hasDocuments = detail.documentSections.length > 0
  const hasExercises = detail.exerciseGroups.length > 0
  const hasFlashcards = detail.flashcardStats.total > 0
  const hasCards = detail.conceptCards.length > 0
  const hasContent = hasDocuments || hasExercises

  if (!hasContent) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Upload className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">No course material for this topic yet.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Upload documents to get started.</p>
          <Link to="/sources" className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--accent-text)] text-white hover:opacity-90 transition-opacity">
            <Upload className="w-3.5 h-3.5" /> Upload documents
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-[960px] mx-auto space-y-6">
        {/* Course Documents */}
        {hasDocuments && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Course Documents</h3>
            <div className="space-y-2">
              {detail.documentSections.map((sec, i) => (
                <Link
                  key={i}
                  to={`/read/${sec.documentId}?topicId=${topicId}`}
                  className="glass-card p-4 flex items-center gap-3 hover:bg-[var(--bg-input)]/30 transition-colors block"
                >
                  <FileText className="w-5 h-5 text-[var(--accent-text)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-heading)] truncate">{sec.documentTitle}</p>
                    <p className="text-xs text-[var(--text-muted)]">{sec.chunkCount} sections about this topic</p>
                  </div>
                  <span className="text-xs text-[var(--accent-text)] font-medium shrink-0 flex items-center gap-1">
                    Read <ExternalLink className="w-3 h-3" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Exam Sources */}
        {hasExercises && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Exam Sources</h3>
            <div className="space-y-2">
              {detail.exerciseGroups.map(group => {
                const completed = group.exercises.filter(e => e.status === 'completed').length
                return (
                  <Link
                    key={group.source.id}
                    to={`/read/${group.source.documentId}?topicId=${topicId}`}
                    className="glass-card p-4 flex items-center gap-3 hover:bg-[var(--bg-input)]/30 transition-colors block"
                  >
                    <ExternalLink className="w-5 h-5 text-orange-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-heading)] truncate">
                        {group.source.name}{group.source.year ? ` ${group.source.year}` : ''}
                        {group.source.institution && <span className="text-[var(--text-faint)]"> · {group.source.institution}</span>}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {completed}/{group.exercises.length} exercises completed
                      </p>
                    </div>
                    <span className="text-xs text-[var(--accent-text)] font-medium shrink-0">Open exam</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Stats summary */}
        {(hasFlashcards || hasCards) && (
          <div className="flex gap-4">
            {hasCards && (
              <div className="glass-card p-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--accent-text)]" />
                <span className="text-xs text-[var(--text-body)]">{detail.conceptCards.length} concept cards</span>
              </div>
            )}
            {hasFlashcards && (
              <div className="glass-card p-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-[var(--text-body)]">
                  {detail.flashcardStats.total} flashcards
                  {detail.flashcardStats.due > 0 && (
                    <span className="text-blue-600 font-medium"> · {detail.flashcardStats.due} due</span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
