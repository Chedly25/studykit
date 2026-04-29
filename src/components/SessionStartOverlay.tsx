/**
 * Session start ritual — shows once per day with context + time picker.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flame, Clock, BookOpen, AlertTriangle, ArrowRight } from 'lucide-react'
import type { DailyStudyLog } from '../db/schema'
import { requestPermission, registerServiceWorker } from '../lib/pushNotifications'
import { Modal, ModalBackdrop } from './ui/motion'

interface Props {
  open: boolean
  streak: number
  dueFlashcardCount: number
  masteryDropTopics: Array<{ name: string; drop: number }>
  topRecommendation?: { topicName: string; reason: string }
  yesterdayStats?: DailyStudyLog
  onStart: (minutes: number) => void
  onDismiss: () => void
}

const TIME_PRESETS = [15, 30, 45, 60, 90]

export function SessionStartOverlay({
  open, streak, dueFlashcardCount, masteryDropTopics,
  topRecommendation, yesterdayStats, onStart, onDismiss,
}: Props) {
  const { t } = useTranslation()
  const [customMinutes, setCustomMinutes] = useState<number | null>(null)

  const handleStart = (minutes: number) => {
    onStart(minutes)
    // Non-blockingly request notification permission
    requestPermission().then(granted => {
      if (granted) registerServiceWorker().catch(() => {})
    }).catch(() => {})
  }

  return (
    <ModalBackdrop
      open={open}
      onClose={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <Modal
        open={open}
        className="glass-card p-6 max-w-md w-full mx-4 space-y-5"
      >
        <div role="dialog" aria-modal="true" aria-labelledby="session-start-title" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="text-center">
          <h2 id="session-start-title" className="text-xl font-bold text-[var(--text-heading)]">{t('session.welcomeBack')}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('session.linedUpForYou')}</p>
        </div>

        {/* Streak */}
        {streak > 0 && (
          <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-[var(--color-warning-bg)]">
            <Flame className="w-5 h-5 text-[var(--color-warning)]" />
            <span className="font-bold text-[var(--text-heading)]">{streak >= 7 ? t('session.streakImpressive', { streak }) : t('session.streakKeepGoing', { streak })}</span>
          </div>
        )}

        {/* Context items */}
        <div className="space-y-2">
          {/* Mastery drops */}
          {masteryDropTopics.length > 0 && (
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
              <div>
                <span className="text-[var(--text-body)]">{t('session.masteryDropped')} </span>
                <span className="text-[var(--text-muted)]">
                  {masteryDropTopics.map(topic => `${topic.name} (-${topic.drop}%)`).join(', ')}
                </span>
              </div>
            </div>
          )}

          {/* Due flashcards */}
          {dueFlashcardCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
              <span className="text-[var(--text-body)]">{t('session.flashcardsDue', { count: dueFlashcardCount })}</span>
            </div>
          )}

          {/* Today's focus */}
          {topRecommendation && (
            <div className="flex items-center gap-2 text-sm">
              <ArrowRight className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
              <div>
                <span className="text-[var(--text-body)]">{t('session.focus')} </span>
                <span className="font-medium text-[var(--text-heading)]">{topRecommendation.topicName}</span>
                <span className="text-[var(--text-muted)]"> — {topRecommendation.reason}</span>
              </div>
            </div>
          )}

          {/* Yesterday's stats */}
          {yesterdayStats && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              <span className="text-[var(--text-muted)]">
                {t('session.yesterdayStats', {
                  mins: Math.round(yesterdayStats.totalSeconds / 60),
                  questions: yesterdayStats.questionsAnswered,
                  accuracy: yesterdayStats.questionsAnswered > 0
                    ? Math.round((yesterdayStats.questionsCorrect / yesterdayStats.questionsAnswered) * 100)
                    : 0,
                })}
              </span>
            </div>
          )}
        </div>

        {/* Time picker */}
        <div>
          <p className="text-sm font-medium text-[var(--text-heading)] mb-2">{t('session.timeQuestion')}</p>
          <div className="flex flex-wrap gap-2">
            {TIME_PRESETS.map(m => (
              <button
                key={m}
                onClick={() => handleStart(m)}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-[var(--bg-input)] text-[var(--text-body)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors"
              >
                {m}min
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min={5}
              max={240}
              placeholder={t('session.custom')}
              className="w-24 px-2 py-1.5 text-sm bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-[var(--text-body)]"
              onChange={e => setCustomMinutes(parseInt(e.target.value) || null)}
            />
            {customMinutes && customMinutes > 0 && (
              <button
                onClick={() => handleStart(customMinutes)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent-text)] text-white hover:opacity-90"
              >
                {t('session.startWith', { mins: customMinutes })}
              </button>
            )}
          </div>
        </div>

        {/* Dismiss */}
        <div className="flex gap-3">
          <button
            onClick={() => handleStart(30)}
            className="flex-1 btn-primary py-2.5 text-sm font-semibold"
          >
            {t('session.letsGo')}
          </button>
          <button
            onClick={onDismiss}
            className="btn-secondary py-2.5 text-sm px-4"
          >
            {t('common.skip')}
          </button>
        </div>
        </div>
      </Modal>
    </ModalBackdrop>
  )
}
