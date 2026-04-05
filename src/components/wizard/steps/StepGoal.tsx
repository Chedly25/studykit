import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GraduationCap, Briefcase, FlaskConical, Languages, Wrench,
  Calendar, Target, ChevronRight, Check, BookMarked, Microscope,
} from 'lucide-react'
import { examBlueprints, getAllExamTypes, getExamBlueprint } from '../../../lib/examTopicMaps'
import { db } from '../../../db'
import type { ExamType, ExamProfile } from '../../../db/schema'
import type { WizardDraft, WizardAction } from '../../../hooks/useWizardDraft'
import { useExamResearch } from '../../../hooks/useExamResearch'
import { useAuth } from '@clerk/clerk-react'

const goalTypeIcons: Record<ExamType, typeof GraduationCap> = {
  'university-course': GraduationCap,
  'professional-exam': Briefcase,
  'graduate-research': FlaskConical,
  'language-learning': Languages,
  'custom': Wrench,
}

type SubStep = 'mode' | 'exam-type' | 'details'

interface StepGoalProps {
  draft: WizardDraft
  dispatch: React.Dispatch<WizardAction>
  onNext: () => void
}

export function StepGoal({ draft, dispatch, onNext }: StepGoalProps) {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const { researchExam } = useExamResearch()
  const [subStep, setSubStep] = useState<SubStep>('mode')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const isResearch = draft.profileMode === 'research'

  const handleNext = async () => {
    if (!draft.examType || !draft.name || (!draft.examDate && !draft.noDeadline)) return
    setIsCreating(true)
    setCreateError('')
    try {
      // Create an INACTIVE profile so it doesn't trigger app-wide live query updates.
      // The profile will be activated in Step 5 ("Start learning").
      // We need the profileId early so document uploads in Steps 2/4 can associate with it.
      const profileId = crypto.randomUUID()
      const blueprint = getExamBlueprint(draft.examType)
      const profile: ExamProfile = {
        id: profileId,
        name: draft.name,
        examType: draft.examType,
        examDate: draft.noDeadline ? '' : draft.examDate,
        isActive: false, // INACTIVE — won't disrupt the current active profile
        passingThreshold: blueprint.defaultPassingThreshold,
        weeklyTargetHours: draft.weeklyTargetHours,
        userId: userId ?? 'local',
        createdAt: new Date().toISOString(),
        profileMode: draft.profileMode,
      }
      await db.examProfiles.put(profile)

      dispatch({ type: 'SET_PROFILE_ID', profileId })

      // Fire background research for non-custom types
      if (draft.examType !== 'custom') {
        researchExam(profileId, draft.name, draft.examType).catch(() => {})
      }

      onNext()
    } catch (err) {
      console.error('Failed to create profile:', err)
      setCreateError(err instanceof Error ? err.message : 'Failed to create profile')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Sub-step: Mode Selection */}
      {subStep === 'mode' && (
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">
            {t('research.modeTitle')}
          </h2>
          <p className="text-[var(--text-muted)] mb-6">
            {t('research.modeSubtitle')}
          </p>

          <div className="grid gap-3">
            <button
              onClick={() => dispatch({ type: 'SET_PROFILE_MODE', mode: 'study' })}
              className={`glass-card p-5 text-left transition-all ${
                draft.profileMode === 'study'
                  ? 'bg-[var(--accent-bg)] ring-1 ring-[var(--accent-text)]/30'
                  : 'hover:border-[var(--text-muted)]/30'
              }`}
              style={draft.profileMode === 'study' ? { borderColor: 'var(--accent-text)' } : undefined}
            >
              <div className="flex items-center gap-3">
                <BookMarked className="w-6 h-6 text-[var(--accent-text)]" />
                <div className="flex-1">
                  <div className="font-semibold text-[var(--text-heading)]">
                    {t('research.modeStudy')}
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {t('research.modeStudyDesc')}
                  </div>
                </div>
                {draft.profileMode === 'study' && <Check className="w-5 h-5 text-[var(--accent-text)]" />}
              </div>
            </button>

            <button
              onClick={() => {
                dispatch({ type: 'SET_PROFILE_MODE', mode: 'research' })
                dispatch({ type: 'SET_EXAM_TYPE', examType: 'graduate-research' })
              }}
              className={`glass-card p-5 text-left transition-all ${
                draft.profileMode === 'research'
                  ? 'bg-[var(--accent-bg)] ring-1 ring-[var(--accent-text)]/30'
                  : 'hover:border-[var(--text-muted)]/30'
              }`}
              style={draft.profileMode === 'research' ? { borderColor: 'var(--accent-text)' } : undefined}
            >
              <div className="flex items-center gap-3">
                <Microscope className="w-6 h-6 text-[var(--accent-text)]" />
                <div className="flex-1">
                  <div className="font-semibold text-[var(--text-heading)]">
                    {t('research.modeResearch')}
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {t('research.modeResearchDesc')}
                  </div>
                </div>
                {draft.profileMode === 'research' && <Check className="w-5 h-5 text-[var(--accent-text)]" />}
              </div>
            </button>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setSubStep('exam-type')}
              className="btn-primary px-6 py-2 flex items-center gap-2"
            >
              {t('common.next')} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sub-step: Goal Type */}
      {subStep === 'exam-type' && (
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">{t('profile.chooseGoal')}</h2>
          <p className="text-[var(--text-muted)] mb-6">{t('profile.selectCategory')}</p>

          <div className="grid gap-3">
            {getAllExamTypes().map(type => {
              const bp = examBlueprints[type]
              const isSelected = draft.examType === type
              const Icon = goalTypeIcons[type]
              return (
                <button
                  key={type}
                  onClick={() => {
                    dispatch({ type: 'SET_EXAM_TYPE', examType: type })
                    if (type !== 'custom') dispatch({ type: 'SET_NAME', name: bp.label })
                  }}
                  className={`glass-card p-4 text-left transition-all ${
                    isSelected
                      ? 'bg-[var(--accent-bg)] ring-1 ring-[var(--accent-text)]/30'
                      : 'hover:border-[var(--text-muted)]/30'
                  }`}
                  style={isSelected ? { borderColor: 'var(--accent-text)' } : undefined}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-[var(--accent-text)]" />
                    <div className="flex-1">
                      <div className="font-semibold text-[var(--text-heading)]">{t(`goalTypes.${type}`)}</div>
                      <div className="text-sm text-[var(--text-muted)]">{t(`goalTypes.${type}-desc`)}</div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-[var(--accent-text)]" />}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={() => setSubStep('mode')} className="btn-secondary px-4 py-2 flex items-center gap-2">
              ← {t('common.back')}
            </button>
            <button
              onClick={() => setSubStep('details')}
              disabled={!draft.examType}
              className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-40"
            >
              {t('common.next')} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sub-step: Details */}
      {subStep === 'details' && (
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">{t('profile.goalDetails')}</h2>
          <p className="text-[var(--text-muted)] mb-6">{t('profile.weeklyHoursDesc')}</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
                {t('profile.profileName')}
              </label>
              <input
                type="text"
                value={draft.name}
                onChange={e => dispatch({ type: 'SET_NAME', name: e.target.value })}
                placeholder={t('profile.namePlaceholder')}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                {t('profile.targetDate')}
              </label>
              {(isResearch || draft.examType === 'custom') && (
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.noDeadline}
                    onChange={e => dispatch({ type: 'SET_NO_DEADLINE', noDeadline: e.target.checked })}
                    className="accent-[var(--accent-text)]"
                  />
                  <span className="text-sm text-[var(--text-muted)]">
                    {t('research.noDeadline')}
                  </span>
                </label>
              )}
              {!draft.noDeadline && (
                <input
                  type="date"
                  value={draft.examDate}
                  onChange={e => dispatch({ type: 'SET_EXAM_DATE', date: e.target.value })}
                  min={new Date().toISOString().slice(0, 10)}
                  className="input-field w-full"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
                <Target className="w-4 h-4 inline mr-1" />
                {t('profile.weeklyHours')}
              </label>
              <input
                type="range"
                min={5}
                max={60}
                value={draft.weeklyTargetHours}
                onChange={e => dispatch({ type: 'SET_WEEKLY_HOURS', hours: Number(e.target.value) })}
                className="w-full accent-[var(--accent-text)]"
              />
              <div className="text-center text-lg font-semibold text-[var(--accent-text)]">
                {draft.weeklyTargetHours}h / week
              </div>
            </div>
          </div>

          {createError && (
            <p className="text-sm text-red-500 mt-4">{createError}</p>
          )}

          <div className="flex justify-between mt-6">
            <button onClick={() => setSubStep('exam-type')} className="btn-secondary px-4 py-2 flex items-center gap-2">
              ← {t('common.back')}
            </button>
            <button
              onClick={handleNext}
              disabled={!draft.name || (!draft.examDate && !draft.noDeadline) || isCreating}
              className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-40"
            >
              {isCreating ? t('common.loading') : t('common.next')}
              {!isCreating && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
