import { Lightbulb } from 'lucide-react'

interface Insight {
  type: 'warning' | 'tip' | 'encouragement'
  message: string
}

interface Props {
  insights: Insight[]
}

export function InsightCard({ insights }: Props) {
  if (insights.length === 0) return null

  const bgColor = {
    warning: 'bg-[var(--color-warning-bg)] border-[var(--color-warning-border)]',
    tip: 'bg-[var(--color-info-bg)] border-[var(--color-info-border)]',
    encouragement: 'bg-[var(--accent-bg)] border-[var(--accent-text)]/20',
  }

  const textColor = {
    warning: 'text-[var(--color-warning)]',
    tip: 'text-[var(--color-info)]',
    encouragement: 'text-[var(--accent-text)]',
  }

  return (
    <div className="space-y-2">
      {insights.slice(0, 2).map((insight, i) => (
        <div key={i} className={`rounded-lg border p-3 ${bgColor[insight.type]}`}>
          <div className="flex items-start gap-2">
            <Lightbulb className={`w-4 h-4 mt-0.5 flex-shrink-0 ${textColor[insight.type]}`} />
            <p className={`text-sm ${textColor[insight.type]}`}>{insight.message}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export type { Insight }
