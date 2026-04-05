/**
 * Expandable textarea for answering a single question in a document exam.
 * Placed between question segments in the continuous document flow.
 */
import { useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react'
import { useState } from 'react'
import { DocumentMarkdown } from './DocumentMarkdown'

export interface DocumentGradingResult {
  earned: number
  max: number
  feedback?: string
}

export interface DocumentModelAnswer {
  questionNumber: number
  modelAnswer: string
  markingScheme?: string
}

interface DocumentAnswerAreaProps {
  questionNumber: number
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  grading?: DocumentGradingResult
  modelAnswer?: DocumentModelAnswer
}

export function DocumentAnswerArea({
  questionNumber,
  value,
  onChange,
  readOnly,
  grading,
  modelAnswer,
}: DocumentAnswerAreaProps) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showModel, setShowModel] = useState(false)
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0

  // Auto-grow textarea
  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.max(120, ta.scrollHeight) + 'px'
  }, [])

  useEffect(() => { autoResize() }, [value, autoResize])

  const hasGrading = grading != null
  const isCorrect = hasGrading && grading.earned > 0
  const borderColor = hasGrading
    ? isCorrect ? 'border-green-500/40' : 'border-red-500/40'
    : 'border-[var(--accent-text)]/30'

  return (
    <div className={`my-4 rounded-lg border ${borderColor} bg-[var(--bg-input)]/50 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-card)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-bg)] w-6 h-6 rounded-full flex items-center justify-center">
            {questionNumber}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {t('documentExam.yourAnswer')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasGrading && (
            <span className={`text-xs font-medium flex items-center gap-1 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
              {isCorrect ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {grading.earned}/{grading.max}
            </span>
          )}
          {!readOnly && (
            <span className="text-xs text-[var(--text-faint)]">
              {wordCount} {t('documentExam.words')}
            </span>
          )}
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={readOnly}
        placeholder={readOnly ? '' : t('documentExam.answerPlaceholder')}
        className={`w-full px-4 py-3 bg-transparent text-sm text-[var(--text-body)] resize-none outline-none min-h-[120px] ${readOnly ? 'opacity-80 cursor-default' : ''}`}
      />

      {/* Grading feedback */}
      {hasGrading && grading.feedback && (
        <div className={`px-4 py-3 border-t text-sm ${isCorrect ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
          <p className="text-[var(--text-body)]">{grading.feedback}</p>
        </div>
      )}

      {/* Model answer (collapsible) */}
      {modelAnswer && (
        <div className="border-t border-[var(--border-card)]">
          <button
            onClick={() => setShowModel(!showModel)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors"
          >
            <span>{t('documentExam.modelAnswer')}</span>
            {showModel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showModel && (
            <div className="px-4 py-3 bg-[var(--bg-card)]">
              <DocumentMarkdown content={modelAnswer.modelAnswer} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
