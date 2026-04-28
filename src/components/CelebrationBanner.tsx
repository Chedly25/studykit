import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { X, Target, Flame, Dumbbell, BookOpen, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { db } from '../db'

interface CelebrationMilestone {
  id: string
  icon: ReactNode
  title: string
  subtitle: string
}

interface Props {
  examProfileId: string
  streak: number
}

export function CelebrationBanner({ examProfileId, streak }: Props) {
  const { t } = useTranslation()
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
    for (const tp of topics) {
      if (tp.mastery >= 0.8) {
        const id = `mastery80_${tp.id}`
        if (!isCelebrated(id)) {
          result.push({
            id,
            icon: <Target className="w-6 h-6 text-[var(--color-success)]" />,
            title: t('celebrate.masteryTitle', { name: tp.name }),
            subtitle: t('celebrate.masterySubtitle'),
          })
        }
      }
    }

    // Streak milestones
    const streakMilestones = [
      { threshold: 7, icon: <Flame className="w-6 h-6 text-[var(--color-warning)]" />, title: t('celebrate.streak7Title'), subtitle: t('celebrate.streak7Subtitle') },
      { threshold: 14, icon: <Flame className="w-6 h-6 text-[var(--color-warning)]" />, title: t('celebrate.streak14Title'), subtitle: t('celebrate.streak14Subtitle') },
      { threshold: 30, icon: <Dumbbell className="w-6 h-6 text-[var(--color-warning)]" />, title: t('celebrate.streak30Title'), subtitle: t('celebrate.streak30Subtitle') },
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
            icon: <BookOpen className="w-6 h-6 text-[var(--color-success)]" />,
            title: t('celebrate.subjectCoverageTitle', { name: s.name }),
            subtitle: t('celebrate.subjectCoverageSubtitle'),
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
          icon: <Trophy className="w-6 h-6 text-[var(--color-warning)]" />,
          title: t('celebrate.firstExamTitle'),
          subtitle: t('celebrate.firstExamSubtitle'),
        })
      }
    }

    return result
  }, [topics, subjects, streak, gradedExamCount, examProfileId, dismissed, t])

  const current = milestones[0] ?? null

  const handleDismiss = (id: string) => {
    try { localStorage.setItem(`celebration_${id}`, 'true') } catch {}
    setDismissed(c => c + 1)
  }

  // Subtle confetti on streak milestones
  useEffect(() => {
    if (!current) return
    if (current.id.startsWith('streak_')) {
      import('../lib/confetti').then(({ fireConfetti }) => fireConfetti('subtle')).catch(() => {})
    }
  }, [current?.id])

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
    <div className="w-full bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-xl p-4 mb-4 flex items-start gap-3 animate-fade-in">
      <div className="shrink-0">{current.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-heading)]">{t('celebrate.milestone')}: {current.title}</p>
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
