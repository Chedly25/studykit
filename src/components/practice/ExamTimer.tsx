import { Clock } from 'lucide-react'

interface ExamTimerProps {
  timeRemaining: number // seconds
}

export function ExamTimer({ timeRemaining }: ExamTimerProps) {
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const isLow = timeRemaining < 300 // < 5 minutes

  return (
    <div className={`flex items-center gap-1.5 text-sm font-mono font-medium ${
      isLow ? 'text-red-500 animate-pulse' : 'text-[var(--text-body)]'
    }`}>
      <Clock className="w-4 h-4" />
      <span>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  )
}
