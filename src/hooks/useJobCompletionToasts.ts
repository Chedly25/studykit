/**
 * Watches background jobs for completion and fires rich Sonner toasts with CTAs.
 * Parses step results for source-processing to show specific counts.
 */
import { useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { db } from '../db'
import { useExamProfile } from './useExamProfile'
import type { BackgroundJob } from '../db/schema'

interface ToastConfig {
  message: string | ((job: BackgroundJob) => string)
  cta: string
  link: string | ((job: BackgroundJob) => string)
}

function getSourceProcessingMessage(job: BackgroundJob): string {
  try {
    const results = JSON.parse(job.stepResults || '{}')
    const saveData = results['save-results']?.data as {
      flashcardCount?: number
      conceptsFound?: string[]
      mappingsApplied?: number
    } | undefined
    const cardData = results['generate-concept-cards']?.data as {
      cardsGenerated?: number
    } | undefined

    const parts: string[] = []
    const flashcards = saveData?.flashcardCount ?? 0
    const conceptCards = cardData?.cardsGenerated ?? 0
    const topicsMapped = saveData?.mappingsApplied ?? 0

    if (flashcards > 0) parts.push(`${flashcards} flashcards`)
    if (conceptCards > 0) parts.push(`${conceptCards} concept cards`)
    if (topicsMapped > 0) parts.push(`${topicsMapped} topics mapped`)

    if (parts.length > 0) {
      return `Document analyzed — ${parts.join(', ')}`
    }
  } catch { /* fall through */ }
  return 'Your document is ready — concept cards and flashcards have been generated'
}

const JOB_TOAST_CONFIG: Record<string, ToastConfig> = {
  'source-processing': {
    message: getSourceProcessingMessage,
    cta: 'View in library',
    link: '/sources',
  },
  'fiche-generation': {
    message: (job) => {
      try {
        const config = JSON.parse(job.config) as { topicName?: string }
        return `✨ Revision fiche ready for ${config.topicName ?? 'topic'}`
      } catch { return '✨ Revision fiche generated' }
    },
    cta: 'View fiche',
    link: (job) => {
      try {
        const config = JSON.parse(job.config) as { topicId?: string }
        if (config.topicId) return `/fiche/${config.topicId}`
      } catch { /* fall through */ }
      return '/dashboard'
    },
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

      const message = typeof config.message === 'function' ? config.message(job) : config.message
      const link = typeof config.link === 'function' ? config.link(job) : config.link

      toast.success(message, {
        duration: 8000,
        action: {
          label: config.cta,
          onClick: () => {
            window.location.href = link
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
