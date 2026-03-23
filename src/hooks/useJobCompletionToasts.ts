/**
 * Watches background jobs for completion and fires rich Sonner toasts with CTAs.
 */
import { useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { db } from '../db'
import { useExamProfile } from './useExamProfile'

const JOB_TOAST_CONFIG: Record<string, { message: string; cta: string; link: string }> = {
  'source-processing': {
    message: 'Your document is ready — concept cards and flashcards have been generated',
    cta: 'View in library',
    link: '/sources',
  },
  'exam-exercise-processing': {
    message: 'Exercises extracted from your exam',
    cta: 'Start practicing',
    link: '/queue',
  },
  'practice-exam-generation': {
    message: 'Practice exam ready',
    cta: 'Take exam',
    link: '/practice-exam',
  },
  'practice-exam-grading': {
    message: 'Exam graded — check your results',
    cta: 'View results',
    link: '/practice-exam',
  },
  'study-plan': {
    message: 'Study plan generated',
    cta: 'View plan',
    link: '/study-plan',
  },
  'exam-research': {
    message: 'Exam format analyzed',
    cta: 'View insights',
    link: '/analytics',
  },
}

export function useJobCompletionToasts() {
  const { activeProfile } = useExamProfile()
  const seenIds = useRef(new Set<string>())

  // Load recently completed jobs (last 60 seconds) using compound index
  const recentJobs = useLiveQuery(async () => {
    if (!activeProfile?.id) return []
    const cutoff = new Date(Date.now() - 60_000).toISOString()
    return db.backgroundJobs
      .where('[examProfileId+status]').equals([activeProfile.id, 'completed'])
      .filter(j => (j.completedAt ?? '') > cutoff)
      .toArray()
  }, [activeProfile?.id]) ?? []

  useEffect(() => {
    for (const job of recentJobs) {
      if (seenIds.current.has(job.id)) continue
      seenIds.current.add(job.id)

      const config = JOB_TOAST_CONFIG[job.type]
      if (!config) continue

      toast.success(config.message, {
        duration: 8000,
        action: {
          label: config.cta,
          onClick: () => {
            window.location.href = config.link
          },
        },
      })
    }
  }, [recentJobs])

  // Cleanup old seen IDs periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (seenIds.current.size > 50) {
        seenIds.current.clear()
      }
    }, 300_000)
    return () => clearInterval(interval)
  }, [])
}
