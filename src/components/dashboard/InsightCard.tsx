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
    warning: 'bg-amber-500/10 border-amber-500/20',
    tip: 'bg-blue-500/10 border-blue-500/20',
    encouragement: 'bg-[var(--accent-bg)] border-[var(--accent-text)]/20',
  }

  const textColor = {
    warning: 'text-amber-600 dark:text-amber-400',
    tip: 'text-blue-600 dark:text-blue-400',
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
