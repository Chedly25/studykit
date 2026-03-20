import { useCallback } from 'react'
import { WizardProgressBar } from './WizardProgressBar'
import { StepGoal } from './steps/StepGoal'
import { StepLandscape } from './steps/StepLandscape'
import { StepAssessment } from './steps/StepAssessment'
import { StepMaterials } from './steps/StepMaterials'
import { StepPriorities } from './steps/StepPriorities'
import { useWizardDraft, type WizardStep } from '../../hooks/useWizardDraft'

const STEP_TIME_ESTIMATES = [0, 2, 3, 2, 2, 1] // minutes per step (0-indexed, step 0 unused)

export function ProjectBriefingWizard() {
  const { draft, dispatch, goToStep } = useWizardDraft()

  const handleStepClick = useCallback((step: WizardStep) => {
    // Only allow navigating to completed steps
    if (step < draft.currentStep) goToStep(step)
  }, [draft.currentStep, goToStep])

  const remainingMinutes = STEP_TIME_ESTIMATES.slice(draft.currentStep).reduce((a, b) => a + b, 0)

  return (
    <div className="animate-fade-in">
      <WizardProgressBar
        currentStep={draft.currentStep}
        onStepClick={handleStepClick}
      />
      <p className="text-center text-xs text-[var(--text-muted)] mb-4">
        Step {draft.currentStep} of 5 · ~{remainingMinutes} min left
      </p>

      {draft.currentStep === 1 && (
        <StepGoal
          draft={draft}
          dispatch={dispatch}
          onNext={() => goToStep(2)}
        />
      )}

      {draft.currentStep === 2 && (
        <StepLandscape
          draft={draft}
          dispatch={dispatch}
          onNext={() => goToStep(3)}
          onBack={() => goToStep(1)}
        />
      )}

      {draft.currentStep === 3 && (
        <>
          <StepAssessment
            draft={draft}
            dispatch={dispatch}
            onNext={() => goToStep(4)}
            onBack={() => goToStep(2)}
          />
          <div className="text-center mt-2">
            <button onClick={() => goToStep(4)} className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors">
              Skip — mark all as new
            </button>
          </div>
        </>
      )}

      {draft.currentStep === 4 && (
        <>
          <StepMaterials
            draft={draft}
            dispatch={dispatch}
            onNext={() => goToStep(5)}
            onBack={() => goToStep(3)}
          />
          <div className="text-center mt-2">
            <button onClick={() => goToStep(5)} className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors">
              Skip — no uploads for now
            </button>
          </div>
        </>
      )}

      {draft.currentStep === 5 && (
        <StepPriorities
          draft={draft}
          dispatch={dispatch}
          onBack={() => goToStep(4)}
        />
      )}
    </div>
  )
}

export default ProjectBriefingWizard
