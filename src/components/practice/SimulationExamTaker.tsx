/**
 * Multi-section exam simulation taker.
 * Sequential sections with per-section timers. Forward-only between sections.
 * Oral sections use voice recording. Section instructions shown before each section.
 */
import { useState, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, AlertTriangle, Shield } from 'lucide-react'
import { db } from '../../db'
// GeneratedQuestion type used implicitly via Dexie queries
import { QuestionRenderer } from './QuestionRenderer'
import { QuestionNav } from './QuestionNav'
import { QuestionFlag } from './QuestionFlag'
import { SectionHeader } from './SectionHeader'
import { OralExamSection } from './OralExamSection'
import { SectionInstructionsOverlay } from './SectionInstructionsOverlay'

export interface SectionConfig {
  examFormatId: string
  formatName: string
  sectionType: string
  timeAllocationMinutes: number
  questionCount: number
  prepTimeMinutes?: number
  instructions?: string
}

interface Props {
  sessionId: string
  examProfileId: string
  sections: SectionConfig[]
  proctorMode: boolean
  onSubmit: () => void
  initialSectionIndex?: number
  onSectionChange?: (sectionIndex: number) => void
}

export function SimulationExamTaker({ sessionId, examProfileId, sections, proctorMode, onSubmit, initialSectionIndex, onSectionChange }: Props) {
  const { t } = useTranslation()
  const [currentSectionIdx, setCurrentSectionIdx] = useState(initialSectionIndex ?? 0)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set())
  const [showSectionConfirm, setShowSectionConfirm] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showInstructions, setShowInstructions] = useState(true)
  const questionStartRef = useRef(Date.now())
  const questionTimesRef = useRef<Map<string, number>>(new Map())

  const currentSection = sections[currentSectionIdx]
  const isLastSection = currentSectionIdx >= sections.length - 1

  // Load all questions for this session
  const allQuestions = useLiveQuery(
    () => db.generatedQuestions.where('sessionId').equals(sessionId).sortBy('questionIndex'),
    [sessionId],
  ) ?? []

  // Questions for current section
  const sectionQuestions = useMemo(() =>
    allQuestions.filter(q => q.sectionIndex === currentSectionIdx),
    [allQuestions, currentSectionIdx],
  )

  const currentQuestion = sectionQuestions[currentQuestionIdx]
  const answeredInSection = sectionQuestions.filter(q => answers.has(q.id) || q.isAnswered).length

  // Flush per-question timing
  const flushTiming = useCallback(() => {
    if (!currentQuestion) return
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000)
    const prev = questionTimesRef.current.get(currentQuestion.id) ?? 0
    questionTimesRef.current.set(currentQuestion.id, prev + elapsed)
    questionStartRef.current = Date.now()
  }, [currentQuestion])

  const handleAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers(prev => new Map(prev).set(questionId, answer))
    db.generatedQuestions.update(questionId, { userAnswer: answer, isAnswered: true }).catch(() => {})
  }, [])

  const handleNavigate = useCallback((idx: number) => {
    flushTiming()
    setCurrentQuestionIdx(idx)
  }, [flushTiming])

  const toggleFlag = useCallback((qId: string) => {
    setFlaggedIds(prev => {
      const next = new Set(prev)
      if (next.has(qId)) next.delete(qId)
      else next.add(qId)
      return next
    })
  }, [])

  const handleFinalSubmit = useCallback(async () => {
    flushTiming()
    for (const [qId, time] of questionTimesRef.current) {
      await db.generatedQuestions.update(qId, { timeSpentSeconds: time }).catch(() => {})
    }
    for (const qId of flaggedIds) {
      await db.generatedQuestions.update(qId, { flagged: true }).catch(() => {})
    }
    for (const [qId, answer] of answers) {
      await db.generatedQuestions.update(qId, { userAnswer: answer, isAnswered: true }).catch(() => {})
    }
    onSubmit()
  }, [flushTiming, flaggedIds, answers, onSubmit])

  const advanceSection = useCallback((newIdx: number) => {
    setCurrentSectionIdx(newIdx)
    setCurrentQuestionIdx(0)
    setShowInstructions(true)
    questionStartRef.current = Date.now()
    onSectionChange?.(newIdx)
  }, [onSectionChange])

  const handleSectionTimeUp = useCallback(() => {
    if (isLastSection) {
      handleFinalSubmit()
    } else {
      advanceSection(currentSectionIdx + 1)
    }
  }, [isLastSection, handleFinalSubmit, advanceSection, currentSectionIdx])

  const handleNextSection = useCallback(() => {
    flushTiming()
    setShowSectionConfirm(false)
    advanceSection(currentSectionIdx + 1)
  }, [flushTiming, advanceSection, currentSectionIdx])

  const handleOralComplete = useCallback(() => {
    if (isLastSection) {
      handleFinalSubmit()
    } else {
      advanceSection(currentSectionIdx + 1)
    }
  }, [isLastSection, handleFinalSubmit, advanceSection, currentSectionIdx])

  if (!currentSection) return null

  // Section instructions overlay — shown before each section starts
  if (showInstructions) {
    return (
      <SectionInstructionsOverlay
        sectionName={currentSection.formatName}
        sectionType={currentSection.sectionType}
        sectionIndex={currentSectionIdx}
        totalSections={sections.length}
        timeAllocation={currentSection.timeAllocationMinutes}
        questionCount={sectionQuestions.length || currentSection.questionCount}
        instructions={currentSection.instructions}
        onBegin={() => setShowInstructions(false)}
      />
    )
  }

  // Oral section renders a completely different UI
  if (currentSection.sectionType === 'oral') {
    return (
      <div className="space-y-4">
        <SectionHeader
          sectionName={currentSection.formatName}
          sectionIndex={currentSectionIdx}
          totalSections={sections.length}
          sectionType={currentSection.sectionType}
          timeAllocationMinutes={currentSection.timeAllocationMinutes}
          answeredCount={answeredInSection}
          totalQuestions={sectionQuestions.length}
          onTimeUp={handleSectionTimeUp}
        />
        {proctorMode && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 px-2">
            <Shield className="w-3 h-3" /> {t('practiceExam.proctorActive', 'Proctor mode active')}
          </div>
        )}
        <OralExamSection
          questions={sectionQuestions}
          prepTimePerQuestion={Math.round(((currentSection.prepTimeMinutes ?? 2) * 60) / Math.max(1, sectionQuestions.length))}
          onComplete={handleOralComplete}
          examProfileId={examProfileId}
        />
      </div>
    )
  }

  // Written section — standard question navigation
  return (
    <div className="space-y-4">
      <SectionHeader
        sectionName={currentSection.formatName}
        sectionIndex={currentSectionIdx}
        totalSections={sections.length}
        sectionType={currentSection.sectionType}
        timeAllocationMinutes={currentSection.timeAllocationMinutes}
        answeredCount={answeredInSection}
        totalQuestions={sectionQuestions.length}
        onTimeUp={handleSectionTimeUp}
      />

      {proctorMode && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 px-2">
          <Shield className="w-3 h-3" /> {t('practiceExam.proctorActive', 'Proctor mode active')}
        </div>
      )}

      {/* Current question */}
      {currentQuestion && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--text-muted)]">
              {t('practiceExam.questionOf', { current: currentQuestionIdx + 1, total: sectionQuestions.length })}
              {currentQuestion.topicName && ` · ${currentQuestion.topicName}`}
            </span>
            <QuestionFlag
              flagged={flaggedIds.has(currentQuestion.id)}
              onToggle={() => toggleFlag(currentQuestion.id)}
            />
          </div>
          <QuestionRenderer
            question={currentQuestion}
            answer={answers.get(currentQuestion.id) ?? currentQuestion.userAnswer ?? ''}
            onAnswer={(answer) => handleAnswer(currentQuestion.id, answer)}
          />
        </div>
      )}

      {/* Navigation */}
      <QuestionNav
        currentIndex={currentQuestionIdx}
        totalQuestions={sectionQuestions.length}
        questionIds={sectionQuestions.map(q => q.id)}
        answeredIds={new Set([...answers.keys(), ...sectionQuestions.filter(q => q.isAnswered).map(q => q.id)])}
        flaggedIds={flaggedIds}
        onNavigate={handleNavigate}
      />

      {/* Section actions */}
      <div className="flex justify-end gap-2">
        {isLastSection ? (
          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="btn-primary px-6 py-2 text-sm"
          >
            {t('practiceExam.submitExam', 'Submit Exam')}
          </button>
        ) : (
          <button
            onClick={() => setShowSectionConfirm(true)}
            className="btn-primary px-6 py-2 text-sm flex items-center gap-2"
          >
            {t('practiceExam.nextSection', 'Next Section')} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Section transition confirmation */}
      {showSectionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-card p-5 max-w-sm w-full mx-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-[var(--text-heading)]">{t('practiceExam.sectionConfirmTitle', 'Move to next section?')}</h3>
            </div>
            <p className="text-sm text-[var(--text-body)]">
              {t('practiceExam.sectionConfirmBody', { section: sections[currentSectionIdx + 1]?.formatName ?? 'next section' })}
            </p>
            {flaggedIds.size > 0 && (
              <p className="text-xs text-amber-600">{t('practiceExam.flaggedWarning', { count: flaggedIds.size })}</p>
            )}
            <div className="flex gap-2">
              <button onClick={handleNextSection} className="flex-1 btn-primary py-2 text-sm">{t('common.continue', 'Continue')}</button>
              <button onClick={() => setShowSectionConfirm(false)} className="btn-secondary py-2 text-sm px-4">{t('common.cancel', 'Cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Submit confirmation */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-card p-5 max-w-sm w-full mx-4 space-y-3">
            <h3 className="font-semibold text-[var(--text-heading)]">{t('practiceExam.confirmSubmit', 'Submit exam?')}</h3>
            {flaggedIds.size > 0 && (
              <p className="text-xs text-amber-600">{t('practiceExam.flaggedWarning', { count: flaggedIds.size })}</p>
            )}
            <div className="flex gap-2">
              <button onClick={handleFinalSubmit} className="flex-1 btn-primary py-2 text-sm">{t('practiceExam.submitExam', 'Submit')}</button>
              <button onClick={() => setShowSubmitConfirm(false)} className="btn-secondary py-2 text-sm px-4">{t('common.cancel', 'Cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
