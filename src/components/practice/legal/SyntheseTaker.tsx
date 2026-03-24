/**
 * Main renderer for the CRFPA Note de Synthèse exercise.
 * Split-pane: dossier browser (left) + writing area (right).
 */
import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { SplitPane } from './SplitPane'
import { DossierPanel } from './DossierPanel'
import type { DossierDoc } from './DossierPanel'
import { SynthesisWritingArea } from './SynthesisWritingArea'
import { useDocumentAutoSave } from '../../../hooks/useDocumentAutoSave'
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

  // Auto-save: reuse the document auto-save hook with a wrapper
  // We store the synthesis answer under key "0" in the answers map
  const answersForSave = { 0: answer } as Record<number, string>
  const { isSaving, lastSaved } = useDocumentAutoSave(sessionId, answersForSave, 1000)

  // Also persist to synthesisAnswer field directly
  useEffect(() => {
    if (!answer) return
    const timer = setTimeout(() => {
      db.practiceExamSessions.update(sessionId, {
        synthesisAnswer: answer,
      }).catch(() => {})
    }, 1000)
    return () => clearTimeout(timer)
  }, [answer, sessionId])

  // Timer
  useEffect(() => {
    if (!timeLimitSeconds) return
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          onSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLimitSeconds, onSubmit])

  const handleSubmit = useCallback(() => {
    // Flush answer before submitting
    db.practiceExamSessions.update(sessionId, {
      synthesisAnswer: answer,
    }).then(() => onSubmit()).catch(() => onSubmit())
  }, [sessionId, answer, onSubmit])

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
          {t('syntheseExam.submit', 'Rendre la copie')}
        </button>
      </div>

      {/* Submit confirmation */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-card p-5 max-w-sm w-full mx-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-[var(--text-heading)]">
                {t('syntheseExam.confirmSubmit', 'Rendre la copie ?')}
              </h3>
            </div>
            <p className="text-sm text-[var(--text-body)]">
              {t('syntheseExam.wordCountInfo', 'Votre synthèse fait {{count}} mots (~{{pages}} page(s)).', {
                count: wordCount,
                pages: Math.max(1, Math.round(wordCount / 600)),
              })}
            </p>
            {wordCount < 1200 && (
              <p className="text-xs text-amber-600">
                {t('syntheseExam.shortWarning', 'Attention : votre synthèse semble courte pour 4 pages.')}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={handleSubmit} className="flex-1 btn-primary py-2 text-sm">
                {t('syntheseExam.submit', 'Rendre la copie')}
              </button>
              <button onClick={() => setShowSubmitConfirm(false)} className="btn-secondary py-2 text-sm px-4">
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
