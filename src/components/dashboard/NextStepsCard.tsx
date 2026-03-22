/**
 * Contextual next-step recommendations on the Dashboard.
 * Shows max 3 priority-ordered suggestions based on current state.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Upload, BookOpen, ListChecks, ClipboardCheck, AlertTriangle, Calendar, ArrowRight } from 'lucide-react'
import type { Topic, Document as Doc } from '../../db/schema'
import type { QueueItem } from '../../lib/dailyQueueEngine'

interface Props {
  topics: Topic[]
  documents: Doc[]
  dueFlashcardCount: number
  dailyQueue: QueueItem[]
  exerciseCount: number
  exerciseAttemptCount: number
  practiceExamCount: number
  hasStudyPlan: boolean
  queueStartedToday: boolean
  isPro: boolean
}

interface Step {
  icon: React.ReactNode
  text: string
  cta: string
  link: string
}

export function NextStepsCard(props: Props) {
  const { t } = useTranslation()
  const steps = computeSteps(props, t)
  if (steps.length === 0) return null

  return (
    <div className="glass-card p-4 mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">{t('dashboard.nextStepsTitle')}</p>
      <div className="space-y-1">
        {steps.map((step, i) => (
          <Link
            key={i}
            to={step.link}
            className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-[var(--bg-input)] transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center shrink-0 text-[var(--accent-text)]">
              {step.icon}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-[var(--text-body)] block">{step.text}</span>
              <span className="text-xs text-[var(--accent-text)] font-medium">{step.cta}</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}

function computeSteps(props: Props, t: (key: string, options?: Record<string, unknown>) => string): Step[] {
  const steps: Step[] = []

  // 1. No documents
  if (props.documents.length === 0) {
    steps.push({
      icon: <Upload size={16} />,
      text: t('dashboard.nextSteps.uploadFirst'),
      cta: t('dashboard.nextSteps.upload'),
      link: '/sources',
    })
  }

  // 2. Unprocessed documents (no summary)
  const unprocessed = props.documents.filter(d => !d.summary)
  if (unprocessed.length > 0 && props.documents.length > 0) {
    steps.push({
      icon: <ListChecks size={16} />,
      text: props.isPro
        ? t('dashboard.nextSteps.documentsNeedProcessing', { count: unprocessed.length })
        : t('dashboard.nextSteps.upgradeToProcess'),
      cta: props.isPro ? t('dashboard.nextSteps.processNow') : t('common.upgrade'),
      link: props.isPro ? '/sources' : '/pricing',
    })
  }

  // 3. Due flashcards
  if (props.dueFlashcardCount > 0) {
    steps.push({
      icon: <BookOpen size={16} />,
      text: t('dashboard.nextSteps.flashcardsDue', { count: props.dueFlashcardCount }),
      cta: t('dashboard.nextSteps.reviewNow'),
      link: '/queue',
    })
  }

  // 4. Queue has items, not started today
  if (props.dailyQueue.length > 0 && !props.queueStartedToday) {
    steps.push({
      icon: <ListChecks size={16} />,
      text: t('dashboard.nextSteps.dailyQueueItems', { count: props.dailyQueue.length }),
      cta: t('common.start'),
      link: '/queue',
    })
  }

  // 5. Exercises available but never attempted
  if (props.exerciseCount > 0 && props.exerciseAttemptCount === 0) {
    steps.push({
      icon: <ListChecks size={16} />,
      text: t('dashboard.nextSteps.exercisesWaiting', { count: props.exerciseCount }),
      cta: t('dashboard.nextSteps.practice'),
      link: '/queue',
    })
  }

  // 6. No practice exam taken
  if (props.practiceExamCount === 0 && props.topics.length >= 3) {
    steps.push({
      icon: <ClipboardCheck size={16} />,
      text: t('dashboard.nextSteps.testYourself'),
      cta: t('dashboard.nextSteps.takeExam'),
      link: '/practice-exam',
    })
  }

  // 7. Weak topics
  const weakTopics = props.topics.filter(tp => tp.mastery < 0.3 && tp.questionsAttempted > 0)
  if (weakTopics.length > 0) {
    const worst = weakTopics.sort((a, b) => a.mastery - b.mastery)[0]
    steps.push({
      icon: <AlertTriangle size={16} />,
      text: t('dashboard.nextSteps.needsAttention', { name: worst.name, percent: Math.round(worst.mastery * 100) }),
      cta: t('dashboard.nextSteps.study'),
      link: `/session?topic=${worst.id}`,
    })
  }

  // 8. No study plan
  if (!props.hasStudyPlan && props.topics.length >= 3) {
    steps.push({
      icon: <Calendar size={16} />,
      text: t('dashboard.nextSteps.createStudyPlan'),
      cta: t('dashboard.nextSteps.plan'),
      link: '/study-plan',
    })
  }

  return steps.slice(0, 3)
}
