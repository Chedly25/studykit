import { useCallback } from 'react'
import { WizardProgressBar } from './WizardProgressBar'
import { StepGoal } from './steps/StepGoal'
import { StepLandscape } from './steps/StepLandscape'
import { StepAssessment } from './steps/StepAssessment'
import { StepMaterials } from './steps/StepMaterials'
import { StepPlanCanvas } from './steps/StepPlanCanvas'
import { useWizardDraft, type WizardStep } from '../../hooks/useWizardDraft'

export function ProjectBriefingWizard() {
  const { draft, dispatch, goToStep } = useWizardDraft()

  const handleStepClick = useCallback((step: WizardStep) => {
    // Only allow navigating to completed steps
    if (step < draft.currentStep) goToStep(step)
  }, [draft.currentStep, goToStep])

  return (
    <div className="animate-fade-in">
      <WizardProgressBar
        currentStep={draft.currentStep}
        onStepClick={handleStepClick}
      />

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
        <StepAssessment
          draft={draft}
          dispatch={dispatch}
          onNext={() => goToStep(4)}
          onBack={() => goToStep(2)}
        />
      )}

      {draft.currentStep === 4 && (
        <StepMaterials
          draft={draft}
          dispatch={dispatch}
          onNext={() => goToStep(5)}
          onBack={() => goToStep(3)}
        />
      )}

      {draft.currentStep === 5 && (
        <StepPlanCanvas
          draft={draft}
          dispatch={dispatch}
          onBack={() => goToStep(4)}
        />
      )}
    </div>
  )
}

export default ProjectBriefingWizard
