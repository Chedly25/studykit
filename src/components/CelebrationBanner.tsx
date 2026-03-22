import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X } from 'lucide-react'
import { db } from '../db'

interface CelebrationMilestone {
  id: string
  icon: string
  title: string
  subtitle: string
}

interface Props {
  examProfileId: string
  streak: number
}

export function CelebrationBanner({ examProfileId, streak }: Props) {
  const [dismissed, setDismissed] = useState(0) // increment to re-check

  const topics = useLiveQuery(
    () => db.topics.where('examProfileId').equals(examProfileId).toArray(),
    [examProfileId],
  ) ?? []

  const subjects = useLiveQuery(
    () => db.subjects.where('examProfileId').equals(examProfileId).toArray(),
    [examProfileId],
  ) ?? []

  const gradedExamCount = useLiveQuery(
    () => db.practiceExamSessions
      .where('examProfileId').equals(examProfileId)
      .filter(s => s.phase === 'graded')
      .count(),
    [examProfileId],
  ) ?? 0

  const milestones = useMemo(() => {
    const result: CelebrationMilestone[] = []

    // Topic mastery >= 80%
    for (const t of topics) {
      if (t.mastery >= 0.8) {
        const id = `mastery80_${t.id}`
        if (!isCelebrated(id)) {
          result.push({
            id,
            icon: '🎯',
            title: `${t.name} mastery reached 80%!`,
            subtitle: "You've built a strong foundation. Keep going.",
          })
        }
      }
    }

    // Streak milestones
    const streakMilestones = [
      { threshold: 7, icon: '🔥', title: '7-day study streak!', subtitle: 'A full week of consistent work. That dedication shows.' },
      { threshold: 14, icon: '🔥', title: '14-day study streak!', subtitle: 'Two weeks strong. Your consistency is building real results.' },
      { threshold: 30, icon: '💪', title: '30-day study streak!', subtitle: "A full month. That's the kind of discipline that passes exams." },
    ]
    for (const m of streakMilestones) {
      if (streak >= m.threshold) {
        const id = `streak_${m.threshold}_${examProfileId}`
        if (!isCelebrated(id)) {
          result.push({ id, icon: m.icon, title: m.title, subtitle: m.subtitle })
        }
      }
    }

    // All topics in a subject >= 60%
    for (const s of subjects) {
      const subjectTopics = topics.filter(t => t.subjectId === s.id)
      if (subjectTopics.length > 0 && subjectTopics.every(t => t.mastery >= 0.6)) {
        const id = `subject60_${s.id}`
        if (!isCelebrated(id)) {
          result.push({
            id,
            icon: '📚',
            title: `All topics in ${s.name} above 60%!`,
            subtitle: 'Solid coverage across the board.',
          })
        }
      }
    }

    // First practice exam completed
    if (gradedExamCount === 1) {
      const id = `first_exam_${examProfileId}`
      if (!isCelebrated(id)) {
        result.push({
          id,
          icon: '🏆',
          title: 'First practice exam completed!',
          subtitle: 'Now you know where you stand. Each exam makes you sharper.',
        })
      }
    }

    return result
  }, [topics, subjects, streak, gradedExamCount, examProfileId, dismissed])

  const current = milestones[0] ?? null

  const handleDismiss = (id: string) => {
    try { localStorage.setItem(`celebration_${id}`, 'true') } catch {}
    setDismissed(c => c + 1)
  }

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!current) return
    const timer = setTimeout(() => {
      handleDismiss(current.id)
    }, 8000)
    return () => clearTimeout(timer)
  }, [current?.id])

  if (!current) return null

  return (
    <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-4 flex items-start gap-3 animate-fade-in">
      <span className="text-2xl shrink-0">{current.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-heading)]">Milestone: {current.title}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{current.subtitle}</p>
      </div>
      <button
        onClick={() => handleDismiss(current.id)}
        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-body)] shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

function isCelebrated(id: string): boolean {
  try { return localStorage.getItem(`celebration_${id}`) === 'true' } catch { return false }
}
