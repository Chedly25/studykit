import { useTranslation } from 'react-i18next'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useSources } from '../hooks/useSources'
import { usePracticeExam } from '../hooks/usePracticeExam'
import { PracticeExamSetup } from '../components/practice/PracticeExamSetup'
import { PracticeExamGenerator } from '../components/practice/PracticeExamGenerator'
import { PracticeExamTaker } from '../components/practice/PracticeExamTaker'
import { PracticeExamResults } from '../components/practice/PracticeExamResults'

export default function PracticeExam() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, weakTopics } = useKnowledgeGraph(profileId)
  const { documentCount } = useSources(profileId)

  const exam = usePracticeExam(profileId)

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('ai.practiceSession')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.createProfileFirst')}</p>
        <a href="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">{t('profile.create')}</a>
      </div>
    )
  }

  if (exam.phase === 'setup') {
    return (
      <PracticeExamSetup
        examProfileId={activeProfile.id}
        subjects={subjects}
        weakTopics={weakTopics}
        documentCount={documentCount}
        onStart={exam.startGeneration}
      />
    )
  }

  if (exam.phase === 'generating') {
    return (
      <PracticeExamGenerator
        progress={exam.generationProgress}
        error={exam.generationError}
        onCancel={() => {
          exam.cancelGeneration()
          exam.resetToSetup()
        }}
      />
    )
  }

  if (exam.phase === 'taking') {
    return (
      <PracticeExamTaker
        questions={exam.questions}
        currentIndex={exam.currentQuestionIndex}
        answers={exam.answers}
        timeRemaining={exam.timeRemaining}
        onAnswer={exam.answerQuestion}
        onNavigate={exam.goToQuestion}
        onSubmit={exam.submitExam}
      />
    )
  }

  // grading or results
  return (
    <PracticeExamResults
      session={exam.session}
      questions={exam.questions}
      isGrading={exam.isGrading}
      gradingProgress={exam.gradingProgress}
      onRetake={exam.resetToSetup}
    />
  )
}
