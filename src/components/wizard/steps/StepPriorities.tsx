import { useState, useCallback } from 'react'
import * as Sentry from '@sentry/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Loader2, ChevronLeft, Rocket, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import { useExamProfile } from '../../../hooks/useExamProfile'
import { clearWizardDraft } from '../../../hooks/useWizardDraft'
import type { WizardDraft, WizardAction } from '../../../hooks/useWizardDraft'
import type { ExtractedSubject } from '../../../ai/topicExtractor'

interface StepPrioritiesProps {
  draft: WizardDraft
  dispatch: React.Dispatch<WizardAction>
  onBack: () => void
}

export function StepPriorities({ draft, dispatch, onBack }: StepPrioritiesProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { seedTopicsForProfile, setActiveProfile } = useExamProfile()

  const [isActivating, setIsActivating] = useState(false)

  // Flatten all topics with their subject info for the priority list
  const allTopics = draft.subjects.flatMap(s =>
    s.topics.map(tp => ({ ...tp, subjectName: s.name, subjectColor: s.color }))
  )

  const moveUp = (index: number) => {
    if (index === 0) return
    const newSubjects = [...draft.subjects]
    // Find which subject/topic this is and swap order
    let count = 0
    for (const s of newSubjects) {
      for (let i = 0; i < s.topics.length; i++) {
        if (count === index) {
          // Swap with previous
          if (i > 0) {
            [s.topics[i - 1], s.topics[i]] = [s.topics[i], s.topics[i - 1]]
          }
          dispatch({ type: 'SET_SUBJECTS', subjects: newSubjects })
          return
        }
        count++
      }
    }
  }

  const moveDown = (index: number) => {
    if (index >= allTopics.length - 1) return
    const newSubjects = [...draft.subjects]
    let count = 0
    for (const s of newSubjects) {
      for (let i = 0; i < s.topics.length; i++) {
        if (count === index) {
          if (i < s.topics.length - 1) {
            [s.topics[i], s.topics[i + 1]] = [s.topics[i + 1], s.topics[i]]
          }
          dispatch({ type: 'SET_SUBJECTS', subjects: newSubjects })
          return
        }
        count++
      }
    }
  }

  const handleActivate = useCallback(async () => {
    const { profileId, subjects, assessments } = draft
    if (!profileId) return

    setIsActivating(true)
    try {
      // 1. Seed topics with assessments + priority order
      const extractedSubjects: ExtractedSubject[] = subjects.map(s => ({
        name: s.name,
        weight: s.weight,
        topics: s.topics.map(tp => ({ name: tp.name })),
      }))
      await seedTopicsForProfile(profileId, extractedSubjects, assessments)

      // 2. Ensure profile is active
      await setActiveProfile(profileId)

      // 3. Clear wizard session and navigate to dashboard
      clearWizardDraft()
      navigate('/dashboard')
    } catch (err) {
      Sentry.captureException(err instanceof Error ? err : new Error('Failed to activate: ' + String(err)))
    } finally {
      setIsActivating(false)
    }
  }, [draft.profileId, draft.subjects, draft.assessments, seedTopicsForProfile, setActiveProfile, navigate])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[var(--text-heading)]">
          {t('wizard.prioritiesTitle')}
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {t('wizard.prioritiesSubtitle')}
        </p>
      </div>

      {/* Weekly hours reminder */}
      <div className="glass-card p-4 mb-4 flex items-center justify-between">
        <span className="text-sm text-[var(--text-body)]">
          {t('wizard.weeklyTarget')}
        </span>
        <span className="text-sm font-semibold text-[var(--accent-text)]">
          {draft.weeklyTargetHours}h / week
        </span>
      </div>

      {/* Priority list */}
      <div className="space-y-2 mb-6">
        {allTopics.map((tp, i) => {
          const assessment = draft.assessments[tp.name]
          return (
            <div
              key={tp.tempId}
              className="glass-card p-3 flex items-center gap-3"
            >
              <GripVertical className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />

              <span className="text-xs font-bold text-[var(--text-muted)] w-6 flex-shrink-0">
                #{i + 1}
              </span>

              <div
                className="w-2 h-8 rounded-full flex-shrink-0"
                style={{ backgroundColor: tp.subjectColor }}
              />

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-heading)] truncate">{tp.name}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {tp.subjectName}
                  {assessment && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                      assessment === 'confident' ? 'bg-green-500/10 text-green-600' :
                      assessment === 'some' ? 'bg-yellow-500/10 text-yellow-600' :
                      'bg-red-500/10 text-red-500'
                    }`}>
                      {assessment === 'confident' ? 'Confident' : assessment === 'some' ? 'Some knowledge' : 'New'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="p-1 rounded hover:bg-[var(--bg-input)] text-[var(--text-muted)] disabled:opacity-20"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === allTopics.length - 1}
                  className="p-1 rounded hover:bg-[var(--bg-input)] text-[var(--text-muted)] disabled:opacity-20"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onBack} className="btn-secondary px-4 py-2 flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> {t('common.back')}
        </button>
        <button
          onClick={handleActivate}
          disabled={isActivating || allTopics.length === 0}
          className="btn-primary px-8 py-3 text-base font-semibold flex items-center gap-2 disabled:opacity-40"
        >
          {isActivating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('wizard.activating')}
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5" />
              {t('wizard.startLearning')}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
