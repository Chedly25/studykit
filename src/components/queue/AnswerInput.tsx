/**
 * Textarea for typing answers in the queue review flow.
 * Supports Ctrl+Enter / Cmd+Enter to submit and optional voice input.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Mic, MicOff, Loader2 } from 'lucide-react'
import type { VoiceInputState } from '../chat/ChatInput'

interface Props {
  placeholder?: string
  onSubmit: (answer: string) => void
  onSkip?: () => void
  disabled?: boolean
  submitLabel?: string
  voiceInput?: VoiceInputState
  initialValue?: string
  onInitialValueConsumed?: () => void
}

export function AnswerInput({ placeholder, onSubmit, onSkip, disabled, submitLabel, voiceInput, initialValue, onInitialValueConsumed }: Props) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  // Accept pre-filled text (from voice transcription)
  useEffect(() => {
    if (initialValue) {
      setValue(initialValue)
      onInitialValueConsumed?.()
      setTimeout(() => ref.current?.focus(), 50)
    }
  }, [initialValue, onInitialValueConsumed])

  useEffect(() => {
    // Auto-focus on mount (skip if recording)
    if (voiceInput?.isRecording || voiceInput?.isTranscribing) return
    const timer = setTimeout(() => ref.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = () => {
    if (disabled) return
    onSubmit(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isRecording = voiceInput?.isRecording ?? false
  const isTranscribing = voiceInput?.isTranscribing ?? false
  const isVoiceBusy = isRecording || isTranscribing

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isRecording ? t('queue.listening', 'Listening...') : (placeholder ?? t('queue.typeYourAnswer', 'Type your answer...'))}
        disabled={disabled || isVoiceBusy}
        className="w-full min-h-[80px] max-h-[200px] rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)] resize-y disabled:opacity-50"
        rows={3}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-faint)]">
          {t('queue.ctrlEnterHint', 'Ctrl+Enter to submit')}
        </span>
        <div className="flex items-center gap-2">
          {/* Voice mic button */}
          {voiceInput && (
            <button
              onClick={() => {
                if (isRecording) {
                  voiceInput.onStopRecording()
                } else if (!isTranscribing) {
                  voiceInput.onStartRecording()
                }
              }}
              disabled={isTranscribing || disabled}
              className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                isRecording
                  ? 'bg-red-500/15 text-red-500 animate-pulse'
                  : isTranscribing
                    ? 'bg-[var(--bg-input)] text-[var(--text-muted)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-input)]'
              }`}
              title={isRecording ? 'Stop recording' : 'Speak your answer'}
            >
              {isTranscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}
          {onSkip && (
            <button
              onClick={onSkip}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
            >
              {t('queue.skipToSelfRate', 'Skip — rate yourself')}
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim() || isVoiceBusy}
            className="btn-primary text-sm px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {submitLabel ?? t('queue.submitAnswer', 'Check my answer')}
          </button>
        </div>
      </div>
    </div>
  )
}
