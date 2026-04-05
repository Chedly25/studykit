/**
 * Cas pratique / consultation / Grand Oral prep renderer.
 * Stacked layout: stimulus (scenario or topic) on top, writing area below.
 * Used for cas pratique, consultation, AND Grand Oral preparation.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock, Save, Check } from 'lucide-react'
import { DocumentMarkdown } from '../document/DocumentMarkdown'
import { db } from '../../../db'

interface CasPratiqueTakerProps {
  sessionId: string
  scenarioContent: string       // The scenario or topic text
  timeLimitSeconds?: number
  savedAnswer?: string
  onSubmit: () => void
  mode?: 'cas-pratique' | 'grand-oral'
}

export function CasPratiqueTaker({
  sessionId,
  scenarioContent,
  timeLimitSeconds,
  savedAnswer,
  onSubmit,
  mode = 'cas-pratique',
}: CasPratiqueTakerProps) {
  const { t } = useTranslation()
  const [answer, setAnswer] = useState(savedAnswer ?? '')
  const [timeRemaining, setTimeRemaining] = useState(timeLimitSeconds ?? 0)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const onSubmitRef = useRef(onSubmit)
  onSubmitRef.current = onSubmit

  // Sync savedAnswer on async load
  const initializedRef = useRef(false)
  useEffect(() => {
    if (!initializedRef.current && savedAnswer && !answer) {
      setAnswer(savedAnswer)
      initializedRef.current = true
    }
  }, [savedAnswer, answer])

  // Sync timer
  useEffect(() => {
    if (timeLimitSeconds && timeLimitSeconds > 0 && timeRemaining === 0) {
      setTimeRemaining(timeLimitSeconds)
    }
  }, [timeLimitSeconds, timeRemaining])

  // Auto-save
  useEffect(() => {
    if (!answer) return
    setIsSaving(true)
    const timer = setTimeout(() => {
      db.practiceExamSessions.update(sessionId, { synthesisAnswer: answer })
        .then(() => setLastSaved(new Date()))
        .catch(() => {})
        .finally(() => setIsSaving(false))
    }, 1000)
    return () => { clearTimeout(timer); setIsSaving(false) }
  }, [answer, sessionId])

  // Timer
  useEffect(() => {
    if (!timeLimitSeconds || timeRemaining <= 0) return
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLimitSeconds, timeRemaining > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit on timer expiry (cas pratique only — grand oral just ends prep)
  useEffect(() => {
    if (timeRemaining === 0 && timeLimitSeconds && timeLimitSeconds > 0 && mode === 'cas-pratique') {
      onSubmitRef.current()
    }
  }, [timeRemaining, timeLimitSeconds, mode])

  const handleSubmit = useCallback(() => {
    db.practiceExamSessions.update(sessionId, { synthesisAnswer: answer })
      .then(() => onSubmitRef.current())
      .catch(() => onSubmitRef.current())
  }, [sessionId, answer])

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0

  // Timer display
  const h = Math.floor(timeRemaining / 3600)
  const m = Math.floor((timeRemaining % 3600) / 60)
  const s = timeRemaining % 60
  const isTimeLow = timeRemaining > 0 && timeRemaining < 600
  const prepEnded = mode === 'grand-oral' && timeRemaining === 0 && (timeLimitSeconds ?? 0) > 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      {/* Header: timer + save */}
      <div className="flex items-center justify-between mb-4">
        {timeRemaining > 0 ? (
          <div className={`flex items-center gap-1.5 text-sm font-mono font-medium ${
            isTimeLow ? 'text-red-500 animate-pulse' : 'text-[var(--text-body)]'
          }`}>
            <Clock className="w-4 h-4" />
            <span>{h > 0 ? `${h}:` : ''}{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>
            {mode === 'grand-oral' && <span className="text-xs text-[var(--text-muted)] ml-2">(préparation)</span>}
          </div>
        ) : prepEnded ? (
          <span className="text-sm font-medium text-amber-500">
            {t('grandOral.prepOver')}
          </span>
        ) : <div />}
        <span className="text-xs text-[var(--text-faint)] flex items-center gap-1">
          {isSaving ? (
            <><Save className="w-3 h-3 animate-pulse" /> {t('documentExam.saving')}</>
          ) : lastSaved ? (
            <><Check className="w-3 h-3 text-green-500" /> {t('documentExam.saved')}</>
          ) : null}
        </span>
      </div>

      {/* Scenario / Topic display */}
      <div className={`glass-card p-5 mb-4 overflow-auto ${
        mode === 'grand-oral' ? 'text-center py-8' : 'max-h-[40vh]'
      }`}>
        {mode === 'grand-oral' ? (
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-3 uppercase tracking-wider">
              {t('grandOral.subject')}
            </p>
            <h2 className="text-lg font-semibold text-[var(--text-heading)] leading-relaxed">
              {scenarioContent}
            </h2>
          </div>
        ) : (
          <DocumentMarkdown content={scenarioContent} />
        )}
      </div>

      {/* Writing area */}
      <div className="flex-1 flex flex-col glass-card overflow-hidden">
        <div className="px-4 py-2 border-b border-[var(--border-card)] flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            {mode === 'grand-oral'
              ? t('grandOral.prepNotes')
              : t('casPratique.yourConsultation')}
          </span>
          <span className="text-xs text-[var(--text-faint)]">
            {wordCount} {t('documentExam.words')}
          </span>
        </div>
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder={mode === 'grand-oral'
            ? t('grandOral.notesPlaceholder')
            : t('casPratique.placeholder')}
          className="flex-1 w-full px-5 py-4 bg-transparent text-sm text-[var(--text-body)] resize-none outline-none leading-relaxed"
          style={{ minHeight: '300px' }}
        />
      </div>

      {/* Submit button */}
      <div className="flex justify-end mt-4">
        <button
          onClick={() => setShowSubmitConfirm(true)}
          className="btn-primary px-6 py-2.5 text-sm"
        >
          {mode === 'grand-oral'
            ? t('grandOral.finish')
            : t('syntheseExam.submit')}
        </button>
      </div>

      {/* Submit confirmation */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-card p-5 max-w-sm w-full mx-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-[var(--text-heading)]">
                {mode === 'grand-oral'
                  ? t('grandOral.confirmEnd')
                  : t('syntheseExam.confirmSubmit')}
              </h3>
            </div>
            {mode === 'cas-pratique' && wordCount < 800 && (
              <p className="text-xs text-amber-600">
                {t('casPratique.shortWarning')}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={handleSubmit} className="flex-1 btn-primary py-2 text-sm">
                {t('common.confirm')}
              </button>
              <button onClick={() => setShowSubmitConfirm(false)} className="btn-secondary py-2 text-sm px-4">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
