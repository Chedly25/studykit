/**
 * Main renderer for the CRFPA Note de Synthèse exercise.
 * Split-pane: dossier browser (left) + writing area (right).
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { SplitPane } from './SplitPane'
import { DossierPanel } from './DossierPanel'
import type { DossierDoc } from './DossierPanel'
import { SynthesisWritingArea } from './SynthesisWritingArea'
import { db } from '../../../db'

interface SyntheseTakerProps {
  sessionId: string
  documents: DossierDoc[]
  timeLimitSeconds?: number
  savedAnswer?: string
  onSubmit: () => void
}

export function SyntheseTaker({
  sessionId,
  documents,
  timeLimitSeconds,
  savedAnswer,
  onSubmit,
}: SyntheseTakerProps) {
  const { t } = useTranslation()
  const [answer, setAnswer] = useState(savedAnswer ?? '')
  const [timeRemaining, setTimeRemaining] = useState(timeLimitSeconds ?? 0)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const onSubmitRef = useRef(onSubmit)
  onSubmitRef.current = onSubmit
  const timerStarted = useRef(false)

  // Fix #11: Sync savedAnswer when it arrives from async live query
  const initializedRef = useRef(false)
  useEffect(() => {
    if (!initializedRef.current && savedAnswer && !answer) {
      setAnswer(savedAnswer)
      initializedRef.current = true
    }
  }, [savedAnswer, answer])

  // Fix #3: Sync timeRemaining when timeLimitSeconds arrives async
  useEffect(() => {
    if (timeLimitSeconds && timeLimitSeconds > 0 && timeRemaining === 0) {
      setTimeRemaining(timeLimitSeconds)
    }
  }, [timeLimitSeconds, timeRemaining])

  // Auto-save synthesisAnswer directly (fix #1: no useDocumentAutoSave)
  useEffect(() => {
    if (!answer) return
    setIsSaving(true)
    const timer = setTimeout(() => {
      db.practiceExamSessions.update(sessionId, {
        synthesisAnswer: answer,
      }).then(() => setLastSaved(new Date()))
        .catch(() => {})
        .finally(() => setIsSaving(false))
    }, 1000)
    return () => { clearTimeout(timer); setIsSaving(false) }
  }, [answer, sessionId])

  // Timer (fix #4: use ref for onSubmit; fix #6: no side effect in updater)
  useEffect(() => {
    if (!timeLimitSeconds || timerStarted.current) return
    timerStarted.current = true
    setTimeRemaining(timeLimitSeconds)
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLimitSeconds])

  // Auto-submit when timer hits 0 (separate from the timer effect)
  useEffect(() => {
    if (timeRemaining === 0 && timeLimitSeconds && timeLimitSeconds > 0) {
      onSubmitRef.current()
    }
  }, [timeRemaining, timeLimitSeconds])

  const handleSubmit = useCallback(() => {
    db.practiceExamSessions.update(sessionId, {
      synthesisAnswer: answer,
    }).then(() => onSubmitRef.current()).catch(() => onSubmitRef.current())
  }, [sessionId, answer])

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0

  return (
    <>
      <SplitPane
        left={<DossierPanel documents={documents} />}
        right={
          <SynthesisWritingArea
            value={answer}
            onChange={setAnswer}
            timeRemaining={timeRemaining > 0 ? timeRemaining : null}
            isSaving={isSaving}
            lastSaved={lastSaved}
          />
        }
        defaultLeftPercent={50}
      />

      {/* Floating submit button */}
      <div className="fixed bottom-4 right-4 z-40 lg:bottom-6 lg:right-6">
        <button
          onClick={() => setShowSubmitConfirm(true)}
          className="btn-primary px-5 py-2.5 text-sm shadow-lg"
        >
          {t('syntheseExam.submit')}
        </button>
      </div>

      {/* Submit confirmation */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-card p-5 max-w-sm w-full mx-4 space-y-3">
            <div className="flex items-center gap-2 text-[var(--color-warning)]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-[var(--text-heading)]">
                {t('syntheseExam.confirmSubmit')}
              </h3>
            </div>
            <p className="text-sm text-[var(--text-body)]">
              {t('syntheseExam.wordCountInfo', 'Votre synthèse fait {{count}} mots (~{{pages}} page(s)).', {
                count: wordCount,
                pages: Math.max(1, Math.round(wordCount / 600)),
              })}
            </p>
            {wordCount < 1200 && (
              <p className="text-xs text-[var(--color-warning)]">
                {t('syntheseExam.shortWarning')}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={handleSubmit} className="flex-1 btn-primary py-2 text-sm">
                {t('syntheseExam.submit')}
              </button>
              <button onClick={() => setShowSubmitConfirm(false)} className="btn-secondary py-2 text-sm px-4">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
