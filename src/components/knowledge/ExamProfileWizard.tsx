import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GraduationCap, Briefcase, FlaskConical, Languages, Wrench, Calendar, Target, ChevronRight, ChevronLeft, BookOpen, Check } from 'lucide-react'
import { useExamProfile } from '../../hooks/useExamProfile'
import { useExamResearch } from '../../hooks/useExamResearch'
import type { ExamType } from '../../db/schema'
import { examBlueprints, getAllExamTypes } from '../../lib/examTopicMaps'

const goalTypeIcons: Record<ExamType, typeof GraduationCap> = {
  'university-course': GraduationCap,
  'professional-exam': Briefcase,
  'graduate-research': FlaskConical,
  'language-learning': Languages,
  'custom': Wrench,
}

type Step = 'exam-type' | 'details' | 'review'

export function ExamProfileWizard() {
  const navigate = useNavigate()
  const { createProfile } = useExamProfile()
  const { researchExam } = useExamResearch()
  const { t } = useTranslation()

  const [step, setStep] = useState<Step>('exam-type')
  const [examType, setExamType] = useState<ExamType | null>(null)
  const [name, setName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [weeklyTarget, setWeeklyTarget] = useState(20)
  const [isCreating, setIsCreating] = useState(false)

  const blueprint = examType ? examBlueprints[examType] : null

  const handleCreate = async () => {
    if (!examType || !name || !examDate) return
    setIsCreating(true)
    try {
      const profileId = await createProfile(name, examType, examDate, weeklyTarget)
      // Trigger exam research for non-custom types (fire-and-forget)
      if (examType !== 'custom' && profileId) {
        researchExam(profileId, name, examType).catch(() => {})
      }
      navigate('/dashboard')
    } catch (err) {
      console.error('Failed to create profile:', err)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {(['exam-type', 'details', 'review'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step === s ? 'bg-[var(--accent-text)] text-white' :
              (['exam-type', 'details', 'review'].indexOf(step) > i) ? 'bg-[var(--accent-text)]/20 text-[var(--accent-text)]' :
              'bg-[var(--bg-input)] text-[var(--text-muted)]'
            }`}>
              {i + 1}
            </div>
            {i < 2 && <div className="w-12 h-0.5 bg-[var(--border-card)]" />}
          </div>
        ))}
      </div>

      {/* Step 1: Goal Type */}
      {step === 'exam-type' && (
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">{t('profile.chooseGoal')}</h2>
          <p className="text-[var(--text-muted)] mb-6">{t('profile.selectCategory')}</p>

          <div className="grid gap-3">
            {getAllExamTypes().map(type => {
              const bp = examBlueprints[type]
              const isSelected = examType === type
              const Icon = goalTypeIcons[type]
              return (
                <button
                  key={type}
                  onClick={() => {
                    setExamType(type)
                    if (type !== 'custom') setName(bp.label)
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
                    {isSelected && (
                      <Check className="w-5 h-5 text-[var(--accent-text)]" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setStep('details')}
              disabled={!examType}
              className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-40"
            >
              {t('common.next')} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 'details' && (
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">{t('profile.goalDetails')}</h2>
          <p className="text-[var(--text-muted)] mb-6">{t('profile.weeklyHoursDesc')}</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1">{t('profile.profileName')}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('profile.namePlaceholder')}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                {t('profile.targetDate')}
              </label>
              <input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="input-field w-full"
              />
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
                value={weeklyTarget}
                onChange={e => setWeeklyTarget(Number(e.target.value))}
                className="w-full accent-[var(--accent-text)]"
              />
              <div className="text-center text-lg font-semibold text-[var(--accent-text)]">{weeklyTarget}h / week</div>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep('exam-type')} className="btn-secondary px-4 py-2 flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" /> {t('common.back')}
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={!name || !examDate}
              className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-40"
            >
              {t('common.next')} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && blueprint && (
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)] mb-2">{t('profile.review')}</h2>
          <p className="text-[var(--text-muted)] mb-6">{t('profile.looksGood')}</p>

          <div className="glass-card p-4 space-y-3 mb-4">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">{t('profile.profileName')}</span>
              <span className="font-medium text-[var(--text-heading)]">{name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">{t('profile.targetDate')}</span>
              <span className="font-medium text-[var(--text-heading)]">{examDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">{t('profile.weeklyHours')}</span>
              <span className="font-medium text-[var(--text-heading)]">{weeklyTarget}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">{t('profile.targetScore')}</span>
              <span className="font-medium text-[var(--text-heading)]">{blueprint.defaultPassingThreshold}%</span>
            </div>
          </div>

          {examType !== 'custom' && blueprint.subjects.length > 0 && blueprint.subjects[0].topics.length > 0 && (
            <div className="glass-card p-4 mb-4">
              <h3 className="font-semibold text-[var(--text-heading)] mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Subjects ({blueprint.subjects.length})
              </h3>
              <div className="space-y-2">
                {blueprint.subjects.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[var(--text-body)]">{s.name}</span>
                    </div>
                    <span className="text-[var(--text-muted)]">
                      {s.weight}% &middot; {s.topics.length} topics
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep('details')} className="btn-secondary px-4 py-2 flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" /> {t('common.back')}
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="btn-primary px-6 py-2 disabled:opacity-60"
            >
              {isCreating ? t('common.loading') : t('profile.createButton')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExamProfileWizard
