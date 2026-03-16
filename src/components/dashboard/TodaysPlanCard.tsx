import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ListChecks } from 'lucide-react'
import type { Topic } from '../../db/schema'

interface Props {
  dueTopics: Topic[]
  dueFlashcardCount: number
  upcomingAssignments: number
}

export function TodaysPlanCard({ dueTopics, dueFlashcardCount, upcomingAssignments }: Props) {
  const { t } = useTranslation()

  const items: Array<{ label: string; count: number; action: string }> = []

  if (dueFlashcardCount > 0) {
    items.push({ label: t('dashboard.dueFlashcards', { count: dueFlashcardCount }), count: dueFlashcardCount, action: '/flashcard-maker' })
  }
  if (dueTopics.length > 0) {
    items.push({ label: t('dashboard.dueForReview'), count: dueTopics.length, action: '/focus' })
  }
  if (upcomingAssignments > 0) {
    items.push({ label: t('dashboard.upcomingAssignments', { count: upcomingAssignments }), count: upcomingAssignments, action: '/assignment-tracker' })
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="w-4 h-4 text-[var(--accent-text)]" />
        <h3 className="font-semibold text-[var(--text-heading)]">{t('dashboard.todaysPlan')}</h3>
      </div>

      {items.length === 0 ? (
        <div>
          <p className="text-sm text-[var(--text-muted)]">{t('dashboard.noPlan')}</p>
          <Link to="/study-plan" className="inline-block mt-2 text-sm text-[var(--accent-text)] hover:underline">
            {t('dashboard.generatePlan')}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-body)]">{item.label}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent-bg)] text-[var(--accent-text)]">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
