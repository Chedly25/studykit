import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useAuth } from '@clerk/clerk-react'
import { Check, Loader2, Sparkles, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useExamProfile } from '../hooks/useExamProfile'
import { useBackgroundJobs } from '../components/BackgroundJobsProvider'
import { useActiveJobs } from '../hooks/useActiveJobs'
import { useSubscription } from '../hooks/useSubscription'
import { db } from '../db'

interface ActivationStep {
  key: string
  status: 'pending' | 'running' | 'done' | 'skipped'
}

export default function SubscriptionSuccess() {
  const { t } = useTranslation()
  const { user } = useUser()
  const { getToken } = useAuth()
  const { isPro } = useSubscription()
  const { activeProfile } = useExamProfile()
  const { enqueue, runAgent } = useBackgroundJobs()
  const profileId = activeProfile?.id
  const activeJobs = useActiveJobs(profileId)

  const [refreshed, setRefreshed] = useState(false)
  const [activationStarted, setActivationStarted] = useState(false)
  const [steps, setSteps] = useState<ActivationStep[]>([
    { key: 'documents', status: 'pending' },
    { key: 'roadmap', status: 'pending' },
    { key: 'plan', status: 'pending' },
    { key: 'content', status: 'pending' },
  ])

  const activationRan = useRef(false)

  // Reload Clerk user data to pick up updated publicMetadata
  useEffect(() => {
    if (user && !refreshed) {
      user.reload().then(() => setRefreshed(true)).catch(() => setRefreshed(true))
    }
  }, [user, refreshed])

  const updateStep = useCallback((key: string, status: ActivationStep['status']) => {
    setSteps(prev => prev.map(s => s.key === key ? { ...s, status } : s))
  }, [])

  // Run activation sequence once Pro is confirmed and profile exists
  useEffect(() => {
    if (!refreshed || !isPro || !profileId || activationRan.current) return
    activationRan.current = true
    setActivationStarted(true)

    ;(async () => {
      try {
        const token = await getToken()
        if (!token) return

        // Step 1: Process unprocessed documents
        updateStep('documents', 'running')
        const unprocessed = await db.documents
          .where('examProfileId').equals(profileId)
          .filter(d => !d.summary)
          .toArray()
        if (unprocessed.length > 0) {
          for (const doc of unprocessed) {
            await enqueue('source-processing', profileId, { documentId: doc.id, isPro: true }, 4)
          }
        }
        updateStep('documents', unprocessed.length > 0 ? 'done' : 'skipped')

        // Step 2: Generate macro roadmap
        updateStep('roadmap', 'running')
        try {
          const { generateMacroRoadmap } = await import('../lib/macroRoadmap')
          await generateMacroRoadmap(profileId, token)
          updateStep('roadmap', 'done')
        } catch {
          updateStep('roadmap', 'skipped')
        }

        // Step 3: Generate study plan
        updateStep('plan', 'running')
        try {
          const { generateStudyPlan } = await import('../ai/studyPlanGenerator')
          await generateStudyPlan(profileId, token, 7)
          updateStep('plan', 'done')
        } catch {
          updateStep('plan', 'skipped')
        }

        // Step 4: Trigger Content Architect agent
        updateStep('content', 'running')
        try {
          await runAgent('content-architect', profileId)
          updateStep('content', 'done')
        } catch {
          updateStep('content', 'skipped')
        }
      } catch {
        // Non-fatal — user can still proceed
      }
    })()
  }, [refreshed, isPro, profileId, getToken, enqueue, runAgent, updateStep])

  const allDone = activationStarted && steps.every(s => s.status === 'done' || s.status === 'skipped')
  const processingJobs = activeJobs.filter(j => j.status === 'running' || j.status === 'queued')

  const stepLabels: Record<string, string> = {
    documents: t('subscription.activatingDocuments'),
    roadmap: t('subscription.activatingRoadmap'),
    plan: t('subscription.activatingPlan'),
    content: t('subscription.activatingContent'),
  }

  // No profile yet — simplified success page
  if (refreshed && !profileId) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center animate-fade-in">
        <Sparkles className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-3">
          {t('subscription.successTitle')}
        </h1>
        <p className="text-[var(--text-muted)] mb-8">
          {t('subscription.successSubtitle')}
        </p>
        <Link to="/welcome" className="btn-primary inline-flex items-center gap-2 px-8 py-2.5">
          {t('subscription.getStarted')} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 animate-fade-in">
      <div className="text-center mb-8">
        <Sparkles className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2">
          {t('subscription.successTitle')}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          {allDone
            ? t('subscription.activatingDone')
            : t('subscription.activatingInProgress')}
        </p>
      </div>

      {/* Activation checklist */}
      {activationStarted && (
        <div className="glass-card p-4 mb-8 space-y-3">
          {steps.map(step => (
            <div key={step.key} className="flex items-center gap-3">
              {step.status === 'done' ? (
                <div className="w-5 h-5 rounded-full bg-[var(--color-success)] flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
              ) : step.status === 'running' ? (
                <Loader2 className="w-5 h-5 text-[var(--accent-text)] animate-spin shrink-0" />
              ) : step.status === 'skipped' ? (
                <div className="w-5 h-5 rounded-full bg-[var(--bg-input)] flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-[var(--text-faint)]" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-[var(--bg-input)] shrink-0" />
              )}
              <span className={`text-sm ${step.status === 'done' ? 'text-[var(--text-heading)]' : 'text-[var(--text-muted)]'}`}>
                {stepLabels[step.key]}
              </span>
            </div>
          ))}
          {processingJobs.length > 0 && (
            <p className="text-xs text-[var(--text-faint)] pt-1">
              {t('subscription.activatingJobsRunning', '{{count}} background tasks running...', { count: processingJobs.length })}
            </p>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="text-center">
        <Link
          to={allDone ? '/queue' : '/dashboard'}
          className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-sm font-semibold"
        >
          {allDone
            ? t('subscription.startFirstSession')
            : t('subscription.goToDashboard')}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
