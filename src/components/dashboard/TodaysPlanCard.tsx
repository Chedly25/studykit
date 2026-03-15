import { ListChecks } from 'lucide-react'
import type { Topic } from '../../db/schema'

interface Props {
  dueTopics: Topic[]
  dueFlashcardCount: number
  upcomingAssignments: number
}

export function TodaysPlanCard({ dueTopics, dueFlashcardCount, upcomingAssignments }: Props) {
  const items: Array<{ label: string; count: number; action: string }> = []

  if (dueFlashcardCount > 0) {
    items.push({ label: 'Flashcards due', count: dueFlashcardCount, action: '/flashcard-maker' })
  }
  if (dueTopics.length > 0) {
    items.push({ label: 'Topics to review', count: dueTopics.length, action: '/focus' })
  }
  if (upcomingAssignments > 0) {
    items.push({ label: 'Assignments due soon', count: upcomingAssignments, action: '/assignment-tracker' })
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="w-4 h-4 text-[var(--accent-text)]" />
        <h3 className="font-semibold text-[var(--text-heading)]">Today's Plan</h3>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">You're all caught up! Start a study session to build your streak.</p>
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
