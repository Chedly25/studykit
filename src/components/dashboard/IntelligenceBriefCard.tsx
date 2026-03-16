import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Eye, ArrowRight } from 'lucide-react'
import type { StudyRecommendation } from '../../lib/studyRecommender'
import type { Insight } from './InsightCard'

interface Props {
  recommendations: StudyRecommendation[]
  insights: Insight[]
  dueFlashcardCount: number
}

export function IntelligenceBriefCard({ recommendations, insights, dueFlashcardCount }: Props) {
  const { t } = useTranslation()

  // Build observation bullets from various sources
  const bullets: Array<{ text: string; to: string }> = []

  // Topics not reviewed in 7+ days
  const staleTopics = recommendations.filter(r => {
    const reason = r.reason.toLowerCase()
    return reason.includes('decay') || reason.includes('refresh')
  })
  if (staleTopics.length > 0) {
    bullets.push({
      text: `${staleTopics.length} topic${staleTopics.length > 1 ? 's' : ''} may need refreshing — depth has decayed`,
      to: '/chat',
    })
  }

  // Due flashcards
  if (dueFlashcardCount > 0) {
    bullets.push({
      text: `${dueFlashcardCount} flashcard${dueFlashcardCount > 1 ? 's' : ''} due for review — retention may be dropping`,
      to: '/flashcard-maker',
    })
  }

  // Strong progress observations
  const strongRecs = recommendations.filter(r => r.decayedMastery > 0.7)
  if (strongRecs.length > 0) {
    bullets.push({
      text: `You've built strong depth on ${strongRecs.map(r => r.topicName).slice(0, 2).join(', ')}`,
      to: '/analytics',
    })
  }

  // Low depth topics
  const lowDepth = recommendations.filter(r => r.decayedMastery < 0.3)
  if (lowDepth.length > 0) {
    bullets.push({
      text: `${lowDepth.length} topic${lowDepth.length > 1 ? 's' : ''} below 30% depth`,
      to: '/practice-exam',
    })
  }

  // Add insight-sourced observations
  for (const insight of insights.slice(0, 2)) {
    if (!bullets.some(b => b.text.includes(insight.message.slice(0, 20)))) {
      bullets.push({
        text: insight.message,
        to: insight.type === 'warning' ? '/analytics' : '/chat',
      })
    }
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-5 h-5 text-[var(--accent-text)]" />
        <h3 className="font-semibold text-[var(--text-heading)]">
          {t('dashboard.intelligenceBrief')}
        </h3>
      </div>

      {bullets.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          {t('dashboard.landscapeEmpty')}
        </p>
      ) : (
        <div className="space-y-1.5">
          {bullets.slice(0, 5).map((bullet, i) => (
            <Link
              key={i}
              to={bullet.to}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--accent-bg)] transition-colors group text-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-text)] shrink-0" />
              <span className="text-[var(--text-body)] flex-1">{bullet.text}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--text-faint)] group-hover:text-[var(--accent-text)] transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
