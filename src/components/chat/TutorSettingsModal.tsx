import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TutorPreferences, TeachingStyle, ExplanationApproach, FeedbackTone, LanguageLevel } from '../../db/schema'

interface Props {
  open: boolean
  onClose: () => void
  preferences: TutorPreferences
  onUpdate: (updates: Partial<Omit<TutorPreferences, 'id' | 'examProfileId'>>) => void
  onReset: () => void
}

function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; description: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-2">{label}</h3>
      <div className="grid grid-cols-2 gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`text-left px-3 py-2 rounded-lg border transition-colors text-sm ${
              value === opt.value
                ? 'border-[var(--accent-text)] bg-[var(--accent-bg)] text-[var(--accent-text)]'
                : 'border-[var(--border-card)] text-[var(--text-muted)] hover:border-[var(--accent-text)]/50'
            }`}
          >
            <div className="font-medium">{opt.label}</div>
            <div className="text-xs opacity-70 mt-0.5">{opt.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function TutorSettingsModal({ open, onClose, preferences, onUpdate, onReset }: Props) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--text-heading)]">{t('ai.tutorSettings')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5">
          <RadioGroup<TeachingStyle>
            label={t('ai.teachingStyle')}
            value={preferences.teachingStyle}
            onChange={v => onUpdate({ teachingStyle: v })}
            options={[
              { value: 'concise', label: t('ai.concise'), description: 'Brief, to-the-point explanations' },
              { value: 'detailed', label: t('ai.detailed'), description: 'Thorough, in-depth explanations' },
            ]}
          />

          <RadioGroup<ExplanationApproach>
            label={t('ai.explanationApproach')}
            value={preferences.explanationApproach}
            onChange={v => onUpdate({ explanationApproach: v })}
            options={[
              { value: 'analogies-first', label: t('ai.analogiesFirst'), description: 'Start with relatable comparisons' },
              { value: 'definitions-first', label: t('ai.definitionsFirst'), description: 'Start with formal definitions' },
              { value: 'examples-first', label: t('ai.examplesFirst'), description: 'Lead with concrete examples' },
              { value: 'step-by-step', label: t('ai.stepByStep'), description: 'Break down into clear steps' },
            ]}
          />

          <RadioGroup<FeedbackTone>
            label={t('ai.feedbackTone')}
            value={preferences.feedbackTone}
            onChange={v => onUpdate({ feedbackTone: v })}
            options={[
              { value: 'encouraging', label: t('ai.encouraging'), description: 'Supportive and motivating' },
              { value: 'direct', label: t('ai.direct'), description: 'Straightforward and frank' },
            ]}
          />

          <RadioGroup<LanguageLevel>
            label={t('ai.languageLevel')}
            value={preferences.languageLevel}
            onChange={v => onUpdate({ languageLevel: v })}
            options={[
              { value: 'beginner-friendly', label: t('ai.beginnerFriendly'), description: 'Simple, accessible language' },
              { value: 'expert', label: t('ai.expert'), description: 'Technical, professional terminology' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border-card)]">
          <button
            onClick={onReset}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
          >
            {t('ai.resetDefaults')}
          </button>
          <button onClick={onClose} className="btn-primary px-4 py-1.5 text-sm">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
