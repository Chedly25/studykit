import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Pause, RotateCcw, MessageCircle, X } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useWritingSession } from '../hooks/useWritingSession'
import { formatTime } from '../lib/timerUtils'

export default function Writing() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { isActive, startSession, endSession, startWordCount } = useWritingSession(profileId)

  const [text, setText] = useState('')
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [sessionResult, setSessionResult] = useState<{ wordsWritten: number; durationSeconds: number } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  // Timer
  useEffect(() => {
    if (isTimerRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1)
      }, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isTimerRunning])

  const handleStart = useCallback(() => {
    if (!isActive) {
      startSession(wordCount)
    }
    setIsTimerRunning(true)
    setSessionResult(null)
    textareaRef.current?.focus()
  }, [isActive, startSession, wordCount])

  const handlePause = useCallback(() => {
    setIsTimerRunning(false)
  }, [])

  const handleStop = useCallback(async () => {
    setIsTimerRunning(false)
    if (isActive) {
      const result = await endSession(wordCount)
      if (result) setSessionResult(result)
    }
    setTimerSeconds(0)
  }, [isActive, endSession, wordCount])

  // Circular timer
  const radius = 70
  const circumference = 2 * Math.PI * radius
  // Show progress based on 25-min increments (pomodoro-style visual)
  const targetSeconds = 25 * 60
  const progress = Math.min(1, timerSeconds / targetSeconds)
  const offset = circumference - progress * circumference

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-6">{t('research.writingSession')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main writing area */}
        <div className="space-y-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t('sources.pastePlaceholder')}
            className="w-full min-h-[60vh] p-6 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-body)] font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]/30"
          />

          {/* Bottom bar */}
          <div className="flex items-center justify-between text-sm text-[var(--text-muted)] px-1">
            <div className="flex items-center gap-4">
              <span>{t('research.wordCount', { count: wordCount })}</span>
              {isActive && (
                <span className="text-[var(--accent-text)]">
                  +{wordCount - startWordCount} words
                </span>
              )}
            </div>
            <span>{formatTime(timerSeconds)}</span>
          </div>

          {/* Session result */}
          {sessionResult && (
            <div className="glass-card p-4 text-center">
              <p className="text-[var(--text-heading)] font-semibold">
                {t('research.wordsWritten', { count: sessionResult.wordsWritten })} in {formatTime(sessionResult.durationSeconds)}
              </p>
            </div>
          )}
        </div>

        {/* Right sidebar: Timer + AI toggle */}
        <div className="space-y-4">
          {/* Timer */}
          <div className="glass-card p-4 flex flex-col items-center">
            <h3 className="font-semibold text-[var(--text-heading)] mb-3 text-sm">{t('research.writingTimer')}</h3>
            <div className="relative mb-4">
              <svg width="160" height="160" className="-rotate-90">
                <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--border-card)" strokeWidth="6" />
                <circle
                  cx="80" cy="80" r={radius}
                  fill="none"
                  stroke="var(--accent-text)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-mono font-bold text-[var(--text-heading)]">{formatTime(timerSeconds)}</span>
                <span className="text-xs text-[var(--text-muted)]">{isTimerRunning ? t('focus.work') : t('common.pause')}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleStop}
                disabled={!isActive}
                className="p-2 rounded-full bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors disabled:opacity-30"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={isTimerRunning ? handlePause : handleStart}
                className="p-3 rounded-full btn-primary"
              >
                {isTimerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* AI toggle */}
          <button
            onClick={() => setShowAI(!showAI)}
            className={`w-full glass-card p-3 flex items-center gap-2 text-sm transition-colors ${
              showAI ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]' : 'text-[var(--text-muted)] hover:text-[var(--accent-text)]'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{t('research.partner')}</span>
          </button>

          {showAI && (
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--text-heading)]">{t('research.partner')}</span>
                <button onClick={() => setShowAI(false)} className="text-[var(--text-muted)] hover:text-[var(--text-heading)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Use the{' '}
                <button
                  onClick={() => { window.dispatchEvent(new CustomEvent('open-chat-panel')); setShowAI(false) }}
                  className="text-[var(--accent-text)] hover:underline"
                >
                  AI Chat panel
                </button>
                {' '}for writing assistance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
