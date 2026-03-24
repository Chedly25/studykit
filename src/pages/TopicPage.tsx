/**
 * Topic detail page — the missing navigation backbone.
 * Route: /topic/:topicId
 * Once this exists, every topic mention across the app becomes a link.
 */
import { useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft, ArrowRight, BookOpen, ClipboardCheck, Brain,
  MessageCircle, Calendar, Layers, FileText, TrendingUp,
} from 'lucide-react'
import { db } from '../db'
import { useExamProfile } from '../hooks/useExamProfile'
import { useTopicDetail } from '../hooks/useTopicDetail'
import { decayedMastery } from '../lib/knowledgeGraph'
import type { Subject } from '../db/schema'

export default function TopicPage() {
  const { topicId } = useParams<{ topicId: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id

  const topicResult = useLiveQuery(
    () => topicId ? db.topics.get(topicId).then(t => t ?? null) : null,
    [topicId],
  ) // undefined = loading, null = not found, Topic = found
  const topic = topicResult ?? undefined

  const subject = useLiveQuery(
    () => topic?.subjectId ? db.subjects.get(topic.subjectId) : undefined,
    [topic?.subjectId],
  ) as Subject | undefined

  const detail = useTopicDetail(topicId ?? null, profileId)

  const decayed = topic ? decayedMastery(topic) : 0
  const masteryPct = topic ? Math.round(topic.mastery * 100) : 0
  const decayedPct = topic ? Math.round(decayed * 100) : 0
  const hasDecay = topic ? topic.mastery - decayed > 0.02 : false

  const masteryColor = masteryPct >= 70 ? 'bg-emerald-500' : masteryPct >= 40 ? 'bg-amber-500' : 'bg-red-500'

  // Sparkline data from mastery trend
  const sparkline = useMemo(() => {
    if (detail.masteryTrend.length < 2) return null
    const values = detail.masteryTrend.map(s => s.mastery)
    const max = Math.max(...values, 0.01)
    const min = Math.min(...values, 0)
    const range = max - min || 0.01
    return values.map(v => ((v - min) / range) * 100)
  }, [detail.masteryTrend])

  // SRS info
  const nextReview = topic?.nextReviewDate
  const isDueToday = nextReview ? nextReview <= new Date().toISOString().slice(0, 10) : false

  if (!topicId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-[var(--text-muted)]">{t('topic.notFound')}</p>
      </div>
    )
  }

  // Loading state
  if (topicResult === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="w-6 h-6 border-2 border-[var(--accent-text)]/30 border-t-[var(--accent-text)] rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  // Not found
  if (topicResult === null) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-[var(--text-muted)]">{t('topic.notFound')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      {/* Back link */}
      {subject && (
        <Link
          to={`/subject/${topic.subjectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {subject.name}
        </Link>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">{topic.name}</h1>
        {subject && (
          <span className="inline-block mt-1 text-xs font-medium text-[var(--accent-text)] bg-[var(--accent-bg)] px-2 py-0.5 rounded-full">
            {subject.name}
          </span>
        )}

        {/* Mastery bar */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2.5 rounded-full bg-[var(--border-card)] overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${masteryColor}`} style={{ width: `${masteryPct}%` }} />
          </div>
          <span className="text-sm font-bold text-[var(--text-heading)] min-w-[3ch] text-right">{masteryPct}%</span>
        </div>
        {hasDecay && (
          <p className="text-xs text-[var(--text-faint)] mt-1">
            {t('topic.decayedMastery', { percent: decayedPct })}
          </p>
        )}
      </div>

      {/* SRS info */}
      <div className="glass-card p-3 mb-4 flex items-center gap-2">
        <Calendar className={`w-4 h-4 ${isDueToday ? 'text-orange-500' : 'text-[var(--text-muted)]'}`} />
        <span className={`text-sm ${isDueToday ? 'font-medium text-orange-500' : 'text-[var(--text-muted)]'}`}>
          {isDueToday
            ? t('topic.dueToday')
            : nextReview
              ? t('topic.nextReview', { date: new Date(nextReview + 'T12:00:00').toLocaleDateString() })
              : t('topic.noReviewScheduled')
          }
        </span>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => navigate(`/practice-exam?topic=${topicId}`)}
          className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
        >
          <ClipboardCheck className="w-4 h-4" /> {t('topic.practice')}
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-chat-panel', { detail: { prefill: `Help me study: ${topic.name}` } }))}
          className="btn-secondary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" /> {t('topic.askAI')}
        </button>
      </div>

      {/* Mastery trend sparkline */}
      {sparkline && (
        <div className="glass-card p-4 mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> {t('topic.masteryTrend')}
          </h3>
          <div className="flex items-end gap-1 h-12">
            {sparkline.map((pct, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-[var(--accent-text)]/60 transition-all"
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Flashcards section */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-heading)] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-500" /> {t('topic.flashcards')}
          </h3>
          {detail.flashcardStats.due > 0 && (
            <Link to="/queue" className="text-xs text-[var(--accent-text)] hover:underline flex items-center gap-1">
              {t('topic.review')} <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {detail.flashcardStats.total} {t('topic.cards')}
          {detail.flashcardStats.due > 0 && (
            <span className="text-orange-500 font-medium"> · {t('topic.dueCount', { count: detail.flashcardStats.due })}</span>
          )}
        </p>
      </div>

      {/* Exercises section */}
      {detail.exerciseGroups.length > 0 && (
        <div className="glass-card p-4 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-heading)] flex items-center gap-2 mb-2">
            <ClipboardCheck className="w-4 h-4 text-orange-500" /> {t('topic.exercises')}
          </h3>
          <div className="space-y-2">
            {detail.exerciseGroups.map(group => {
              const attempted = group.exercises.filter(e => e.attemptCount > 0).length
              return (
                <div key={group.source.id} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-body)] truncate">
                    {group.source.name}{group.source.year ? ` ${group.source.year}` : ''}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] shrink-0 ml-2">
                    {attempted}/{group.exercises.length} {t('topic.attempted')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Concept cards section */}
      {detail.conceptCards.length > 0 && (
        <div className="glass-card p-4 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-heading)] flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-blue-500" /> {t('topic.conceptCards')}
          </h3>
          <div className="space-y-1.5">
            {detail.conceptCards.map(card => {
              const cardMastery = card.mastery ?? 0
              const color = cardMastery >= 0.7 ? 'bg-emerald-500' : cardMastery >= 0.4 ? 'bg-amber-500' : 'bg-[var(--border-card)]'
              return (
                <div key={card.id} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-[var(--text-body)] truncate">{card.title}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Source material */}
      {detail.documentSections.length > 0 && (
        <div className="glass-card p-4 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-heading)] flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-blue-500" /> {t('topic.sourceMaterial')}
          </h3>
          <div className="space-y-1.5">
            {detail.documentSections.map(section => (
              <Link
                key={section.documentId}
                to={`/read/${section.documentId}`}
                className="flex items-center justify-between text-sm hover:bg-[var(--bg-input)] px-2 py-1.5 rounded-lg transition-colors"
              >
                <span className="text-[var(--text-body)] truncate">{section.documentTitle}</span>
                <span className="text-xs text-[var(--text-faint)] shrink-0 ml-2 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> {section.chunkCount}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {(topic.questionsAttempted > 0) && (
        <div className="glass-card p-4 mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">{t('topic.stats')}</h3>
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-lg font-bold text-[var(--text-heading)]">{topic.questionsAttempted}</div>
              <span className="text-xs text-[var(--text-muted)]">{t('topic.questionsAttempted')}</span>
            </div>
            <div>
              <div className={`text-lg font-bold ${topic.questionsCorrect / topic.questionsAttempted >= 0.7 ? 'text-emerald-500' : 'text-orange-500'}`}>
                {Math.round((topic.questionsCorrect / topic.questionsAttempted) * 100)}%
              </div>
              <span className="text-xs text-[var(--text-muted)]">{t('topic.accuracy')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
