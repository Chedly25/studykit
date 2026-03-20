import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react'
import type { WizardDraft, WizardAction } from '../../../hooks/useWizardDraft'

type FamiliarityLevel = 'new' | 'some' | 'confident'

interface StepAssessmentProps {
  draft: WizardDraft
  dispatch: React.Dispatch<WizardAction>
  onNext: () => void
  onBack: () => void
}

export function StepAssessment({ draft, dispatch, onNext, onBack }: StepAssessmentProps) {
  const { t } = useTranslation()
  const isResearch = draft.profileMode === 'research'

  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    () => new Set(draft.subjects.slice(0, 1).map(s => s.tempId))
  )

  const toggleSubject = useCallback((tempId: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev)
      if (next.has(tempId)) next.delete(tempId)
      else next.add(tempId)
      return next
    })
  }, [])

  const setFamiliarity = useCallback((key: string, level: FamiliarityLevel) => {
    dispatch({ type: 'SET_ASSESSMENT', key, level })
  }, [dispatch])

  // Count assessed topics
  const totalTopics = draft.subjects.reduce((sum, s) => sum + s.topics.length, 0)
  const assessedTopics = Object.keys(draft.assessments).length

  const researchStages: FamiliarityLevel[] = ['new', 'some', 'confident']
  const researchLabels: Record<FamiliarityLevel, string> = {
    new: isResearch ? t('wizard.researchExplored', 'Unexplored') : t('dashboard.onboarding.familiarityNew'),
    some: isResearch ? t('wizard.researchInProgress', 'In progress') : t('dashboard.onboarding.familiaritySome'),
    confident: isResearch ? t('wizard.researchDeep', 'Deep knowledge') : t('dashboard.onboarding.familiarityConfident'),
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-1">
        {isResearch
          ? t('wizard.assessTitleResearch', 'Where are you in your research?')
          : t('dashboard.onboarding.assessTitle', 'Review your study topics')
        }
      </h2>
      <p className="text-sm text-[var(--text-muted)] mb-1">
        {isResearch
          ? t('wizard.assessSubtitleResearch', 'Rate your familiarity with each area')
          : t('dashboard.onboarding.assessSubtitle')
        }
      </p>
      <p className="text-xs text-[var(--text-muted)] mb-3">
        {t('dashboard.onboarding.assessHint')}
        {totalTopics > 0 && (
          <span className="ml-2 text-[var(--accent-text)]">
            ({assessedTopics}/{totalTopics} {t('wizard.assessed', 'rated')})
          </span>
        )}
      </p>

      {/* Bulk action buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            draft.subjects.forEach((subject, si) => {
              subject.topics.forEach((_, ti) => {
                setFamiliarity(`${si}-${ti}`, 'new')
              })
            })
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
        >
          Mark All as New
        </button>
        <button
          onClick={() => {
            draft.subjects.forEach((subject, si) => {
              subject.topics.forEach((_, ti) => {
                setFamiliarity(`${si}-${ti}`, 'some')
              })
            })
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 transition-colors"
        >
          Mark All as Some Knowledge
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {draft.subjects.map((subject, si) => {
          const isExpanded = expandedSubjects.has(subject.tempId)

          return (
            <div key={subject.tempId} className="border border-[var(--border-card)] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSubject(subject.tempId)}
                className="w-full flex items-center gap-3 p-4 hover:bg-[var(--accent-bg)]/30 transition-colors"
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                )}
                <span className="font-semibold text-[var(--text-heading)] flex-1 text-left">
                  {subject.name}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {subject.topics.length} {subject.topics.length === 1 ? 'topic' : 'topics'}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-[var(--border-card)] divide-y divide-[var(--border-card)]">
                  {subject.topics.map((topic, ti) => {
                    const key = `${si}-${ti}`
                    const level = draft.assessments[key] ?? 'new'

                    return (
                      <div key={topic.tempId} className="flex items-center gap-3 p-3 px-4">
                        <span className="flex-1 text-sm text-[var(--text-body)]">{topic.name}</span>
                        <div className="flex gap-1">
                          {researchStages.map(l => (
                            <button
                              key={l}
                              onClick={() => setFamiliarity(key, l)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                level === l
                                  ? l === 'new'
                                    ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                    : l === 'some'
                                    ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
                                    : 'bg-green-500/15 text-green-600 dark:text-green-400'
                                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)]'
                              }`}
                            >
                              {researchLabels[l]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="btn-secondary px-4 py-2 flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> {t('common.back')}
        </button>
        <button
          onClick={onNext}
          className="btn-primary px-6 py-2 flex items-center gap-2"
        >
          {t('common.next')} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
