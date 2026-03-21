/**
 * Expandable topic detail panel — shows exercises, flashcards, concepts,
 * documents, and mastery trend for a single topic.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, BookOpen, FileText, TrendingUp, TrendingDown, Minus, Star, ChevronDown, ChevronRight, ExternalLink, MessageCircle } from 'lucide-react'
import { useTopicDetail } from '../../hooks/useTopicDetail'
import { SkeletonLine, SkeletonBlock } from '../Skeleton'
import { MathText } from '../MathText'

interface Props {
  topicId: string
  topicName: string
  subjectName: string
  mastery: number
  examProfileId: string
  questionsAttempted: number
  questionsCorrect: number
}

function statusBadge(status: string, score?: number) {
  if (status === 'completed') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600">Done {score != null ? `${Math.round(score * 100)}%` : ''}</span>
  if (status === 'attempted') return <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-600">Attempted {score != null ? `${Math.round(score * 100)}%` : ''}</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-faint)]">Not started</span>
}

function difficultyStars(level: number) {
  return (
    <span className="inline-flex gap-px">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-2.5 h-2.5 ${i <= level ? 'fill-amber-400 text-amber-400' : 'text-[var(--border-card)]'}`} />
      ))}
    </span>
  )
}

export function TopicDetailPanel({ topicId, topicName, subjectName, mastery, examProfileId, questionsAttempted, questionsCorrect }: Props) {
  const detail = useTopicDetail(topicId, examProfileId)
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const [showSolution, setShowSolution] = useState<Set<string>>(new Set())
  const [expandedFicheId, setExpandedFicheId] = useState<string | null>(null)

  const dispatchAI = (prefill: string) => {
    window.dispatchEvent(new CustomEvent('open-chat-panel', {
      detail: { prefill, context: { topicId, topicName, subjectName, mastery } }
    }))
  }

  const toggleSolution = (id: string) => {
    setShowSolution(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (detail.isLoading) {
    return (
      <div className="px-10 py-4 space-y-3 border-b border-[var(--border-card)]/30 bg-[var(--bg-input)]/10 animate-fade-in">
        <SkeletonLine width="w-32" />
        <SkeletonBlock height="h-20" />
        <SkeletonLine width="w-48" />
      </div>
    )
  }

  const accuracy = questionsAttempted > 0 ? Math.round((questionsCorrect / questionsAttempted) * 100) : null
  const masteryPct = Math.round(mastery * 100)

  // Trend: compare first and last mastery snapshot
  const trend = detail.masteryTrend.length >= 2
    ? detail.masteryTrend[detail.masteryTrend.length - 1].mastery - detail.masteryTrend[0].mastery
    : 0
  const TrendIcon = trend > 0.02 ? TrendingUp : trend < -0.02 ? TrendingDown : Minus
  const trendColor = trend > 0.02 ? 'text-emerald-500' : trend < -0.02 ? 'text-red-500' : 'text-[var(--text-faint)]'

  const hasContent = detail.exerciseGroups.length > 0 || detail.flashcardStats.total > 0 ||
    detail.conceptCards.length > 0 || detail.documentSections.length > 0

  return (
    <div className="px-10 py-4 border-b border-[var(--border-card)]/30 bg-[var(--bg-input)]/10 animate-fade-in space-y-4">
      {/* Mastery header */}
      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <span className="font-semibold text-[var(--text-heading)]">{masteryPct}% mastery</span>
        <TrendIcon className={`w-3 h-3 ${trendColor}`} />
        {accuracy !== null && <span>{questionsAttempted} questions · {accuracy}% accuracy</span>}
      </div>

      {/* Exercises */}
      {detail.exerciseGroups.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Exercises</p>
          <div className="space-y-3">
            {detail.exerciseGroups.map(group => (
              <div key={group.source.id}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-[var(--text-heading)]">
                    {group.source.name}{group.source.year ? ` ${group.source.year}` : ''}
                    {group.source.institution && <span className="text-[var(--text-faint)]"> · {group.source.institution}</span>}
                  </p>
                  <Link
                    to={`/read/${group.source.documentId}`}
                    className="text-[10px] text-[var(--accent-text)] hover:underline flex items-center gap-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" /> Open exam
                  </Link>
                </div>
                <div className="space-y-0.5">
                  {group.exercises.map(ex => (
                    <div key={ex.id}>
                      <button
                        onClick={() => setExpandedExerciseId(prev => prev === ex.id ? null : ex.id)}
                        className="w-full flex items-center gap-2 text-xs pl-2 py-1 hover:bg-[var(--bg-input)]/30 rounded text-left"
                      >
                        {expandedExerciseId === ex.id
                          ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                          : <ChevronRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                        }
                        <span className="text-[var(--text-body)]">Ex. {ex.exerciseNumber}</span>
                        {difficultyStars(ex.difficulty)}
                        {statusBadge(ex.status, ex.lastAttemptScore ?? undefined)}
                        <span className="flex-1" />
                        <span
                          onClick={(e) => { e.stopPropagation(); dispatchAI(`Explain this exercise:\n${ex.text.slice(0, 500)}`) }}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors"
                          title="Ask AI about this exercise"
                        >
                          <Sparkles className="w-3 h-3" />
                        </span>
                      </button>
                      {expandedExerciseId === ex.id && (
                        <div className="pl-6 py-2 text-xs">
                          <div className="glass-card p-3 text-[var(--text-body)] whitespace-pre-wrap mb-2">
                            <MathText>{ex.text}</MathText>
                          </div>
                          {ex.solutionText && (
                            <>
                              <button
                                onClick={() => toggleSolution(ex.id)}
                                className="text-[var(--accent-text)] text-[10px] hover:underline mb-1"
                              >
                                {showSolution.has(ex.id) ? 'Hide correction' : 'Show correction'}
                              </button>
                              {showSolution.has(ex.id) && (
                                <div className="glass-card p-3 text-[var(--text-body)] whitespace-pre-wrap border-l-2 border-emerald-500 mb-2">
                                  <MathText>{ex.solutionText}</MathText>
                                </div>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => dispatchAI(`Help me with this exercise:\n${ex.text.slice(0, 500)}${ex.solutionText ? '\n\nReference solution:\n' + ex.solutionText.slice(0, 500) : ''}`)}
                            className="flex items-center gap-1 text-[10px] text-[var(--accent-text)] hover:underline mt-1"
                          >
                            <MessageCircle className="w-3 h-3" /> Discuss with AI
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flashcards */}
      {detail.flashcardStats.total > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Flashcards</p>
          <div className="flex items-center gap-2 text-xs text-[var(--text-body)]">
            <BookOpen className="w-3 h-3 text-[var(--text-muted)]" />
            <span>{detail.flashcardStats.total} cards</span>
            {detail.flashcardStats.due > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600">{detail.flashcardStats.due} due</span>
            )}
          </div>
        </div>
      )}

      {/* Fiches */}
      {detail.conceptCards.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Fiches</p>
          <div className="space-y-0.5">
            {detail.conceptCards.map(card => {
              let keyPoints: string[] = []
              try { keyPoints = JSON.parse(card.keyPoints) } catch { /* ignore */ }
              return (
                <div key={card.id}>
                  <button
                    onClick={() => setExpandedFicheId(prev => prev === card.id ? null : card.id)}
                    className="text-xs text-[var(--text-body)] pl-2 flex items-center gap-1 hover:text-[var(--accent-text)] w-full text-left"
                  >
                    {expandedFicheId === card.id
                      ? <ChevronDown className="w-3 h-3 shrink-0" />
                      : <ChevronRight className="w-3 h-3 shrink-0" />
                    }
                    <MathText>{card.title}</MathText>
                  </button>
                  {expandedFicheId === card.id && (
                    <div className="pl-6 py-1 space-y-1">
                      {keyPoints.map((p, i) => (
                        <p key={i} className="text-xs text-[var(--text-body)]">• <MathText>{p}</MathText></p>
                      ))}
                      {card.example && (
                        <p className="text-xs text-[var(--text-muted)] italic"><MathText>{card.example}</MathText></p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Documents */}
      {detail.documentSections.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">From your documents</p>
          <div className="space-y-0.5">
            {detail.documentSections.map((sec, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-body)] pl-2">
                <FileText className="w-3 h-3 text-[var(--text-muted)]" />
                <span className="flex-1">{sec.chunkCount} sections from {sec.documentTitle}</span>
                <Link
                  to={`/read/${sec.documentId}`}
                  className="text-[10px] text-[var(--accent-text)] hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  Read
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasContent && (
        <p className="text-xs text-[var(--text-muted)] italic">No exercises, flashcards, or documents for this topic yet.</p>
      )}

      {/* Ask AI footer */}
      <button
        onClick={() => dispatchAI(`Help me study ${topicName}`)}
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent-text)] hover:underline"
      >
        <Sparkles className="w-3 h-3" /> Ask AI about this topic
      </button>
    </div>
  )
}
