/**
 * Section header bar for simulation exam mode.
 * Shows section name, countdown timer, question progress.
 */
import { useState, useEffect, useRef } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'

interface Props {
  sectionName: string
  sectionIndex: number
  totalSections: number
  sectionType: string
  timeAllocationMinutes: number
  answeredCount: number
  totalQuestions: number
  onTimeUp: () => void
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function SectionHeader({ sectionName, sectionIndex, totalSections, sectionType, timeAllocationMinutes, answeredCount, totalQuestions, onTimeUp }: Props) {
  const [remaining, setRemaining] = useState(timeAllocationMinutes * 60)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const firedRef = useRef(false)

  useEffect(() => {
    setRemaining(timeAllocationMinutes * 60)
    firedRef.current = false
  }, [sectionIndex, timeAllocationMinutes])

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1 && !firedRef.current) {
          firedRef.current = true
          onTimeUp()
          return 0
        }
        return Math.max(0, prev - 1)
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [sectionIndex, onTimeUp])

  const isWarning = remaining > 0 && remaining <= 300 // 5 minutes
  const isExpired = remaining <= 0

  return (
    <div className="glass-card px-4 py-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-[var(--accent-text)] bg-[var(--accent-bg)] px-2 py-0.5 rounded-full">
          {sectionIndex + 1}/{totalSections}
        </span>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">{sectionName}</h3>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            {sectionType} · {answeredCount}/{totalQuestions} answered
          </span>
        </div>
      </div>
      <div className={`flex items-center gap-1.5 text-sm font-mono font-bold ${
        isExpired ? 'text-red-500' : isWarning ? 'text-amber-500 animate-pulse' : 'text-[var(--text-heading)]'
      }`}>
        {isWarning && <AlertTriangle className="w-4 h-4" />}
        <Clock className="w-4 h-4" />
        {formatTime(remaining)}
      </div>
    </div>
  )
}
