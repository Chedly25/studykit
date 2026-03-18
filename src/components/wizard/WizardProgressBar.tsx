import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import type { WizardStep } from '../../hooks/useWizardDraft'

const STEPS: { step: WizardStep; labelKey: string }[] = [
  { step: 1, labelKey: 'wizard.stepGoal' },
  { step: 2, labelKey: 'wizard.stepLandscape' },
  { step: 3, labelKey: 'wizard.stepAssessment' },
  { step: 4, labelKey: 'wizard.stepMaterials' },
  { step: 5, labelKey: 'wizard.stepPlan' },
]

interface WizardProgressBarProps {
  currentStep: WizardStep
  onStepClick?: (step: WizardStep) => void
}

export function WizardProgressBar({ currentStep, onStepClick }: WizardProgressBarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-1 sm:gap-2 mb-8">
      {STEPS.map(({ step, labelKey }, i) => {
        const isActive = currentStep === step
        const isCompleted = currentStep > step
        const isClickable = isCompleted && onStepClick

        return (
          <div key={step} className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--accent-text)] text-white'
                  : isCompleted
                  ? 'bg-[var(--accent-text)]/15 text-[var(--accent-text)] cursor-pointer hover:bg-[var(--accent-text)]/25'
                  : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
              } ${!isClickable ? 'cursor-default' : ''}`}
            >
              {isCompleted ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-current/30">
                  {step}
                </span>
              )}
              <span className="hidden sm:inline">{t(labelKey)}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-4 sm:w-8 h-0.5 transition-colors ${
                currentStep > step ? 'bg-[var(--accent-text)]/40' : 'bg-[var(--border-card)]'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
