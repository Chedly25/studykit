import { Calendar } from 'lucide-react'

interface Props {
  examName: string
  examDate: string // YYYY-MM-DD
}

export function ExamCountdownCard({ examName, examDate }: Props) {
  const now = new Date()
  const exam = new Date(examDate + 'T00:00:00')
  const diffMs = exam.getTime() - now.getTime()
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
  const weeksLeft = Math.floor(daysLeft / 7)
  const remainingDays = daysLeft % 7

  const urgency = daysLeft <= 30 ? 'text-red-500' : daysLeft <= 90 ? 'text-amber-500' : 'text-[var(--accent-text)]'

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-[var(--accent-text)]" />
        <h3 className="font-semibold text-[var(--text-heading)]">Exam Countdown</h3>
      </div>
      <div className={`text-3xl font-bold ${urgency}`}>
        {daysLeft}
        <span className="text-base font-normal text-[var(--text-muted)]"> days</span>
      </div>
      <div className="text-sm text-[var(--text-muted)] mt-1">
        {weeksLeft > 0 && `${weeksLeft}w ${remainingDays}d`}
        {weeksLeft === 0 && `${daysLeft} days`}
        {' '}until {examName}
      </div>
      <div className="text-xs text-[var(--text-faint)] mt-1">
        {exam.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  )
}
