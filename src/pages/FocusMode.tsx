import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useFocusMode } from '../hooks/useFocusMode'
import { db } from '../db'
import type { Subject } from '../db/schema'
import { formatTime } from '../lib/timerUtils'

export default function FocusMode() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const {
    phase, timeLeft, isRunning, sessionsCompleted,
    settings, start, pause, reset, skip, updateSettings,
  } = useFocusMode(profileId)

  const subjects = useLiveQuery(
    () => profileId
      ? db.subjects.where('examProfileId').equals(profileId).sortBy('order')
      : Promise.resolve([] as Subject[]),
    [profileId]
  ) ?? []

  const phaseLabel = {
    work: t('focus.work'),
    'short-break': t('focus.shortBreak'),
    'long-break': t('focus.longBreak'),
  }[phase]
  const phaseColor = phase === 'work' ? 'var(--accent-text)' : '#f59e0b'

  // Circular progress
  const radius = 90
  const circumference = 2 * Math.PI * radius
  const totalDuration = phase === 'work' ? settings.workDuration
    : phase === 'short-break' ? settings.shortBreakDuration
    : settings.longBreakDuration
  const progress = totalDuration > 0 ? (totalDuration - timeLeft) / totalDuration : 0
  const offset = circumference - progress * circumference

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-6 text-center">{t('focus.title')}</h1>

      {/* Subject selector */}
      {subjects.length > 0 && (
        <div className="glass-card p-4 mb-6">
          <label className="block text-sm font-medium text-[var(--text-body)] mb-2">{t('focus.selectSubject')}</label>
          <select
            value={settings.selectedSubjectId ?? ''}
            onChange={e => updateSettings({ selectedSubjectId: e.target.value || undefined })}
            className="select-field w-full"
          >
            <option value="">{t('focus.selectSubject')}</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Timer */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <svg width="220" height="220" className="-rotate-90">
            <circle
              cx="110" cy="110" r={radius}
              fill="none"
              stroke="var(--border-card)"
              strokeWidth="8"
            />
            <circle
              cx="110" cy="110" r={radius}
              fill="none"
              stroke={phaseColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-mono font-bold text-[var(--text-heading)]">{formatTime(timeLeft)}</span>
            <span className="text-sm text-[var(--text-muted)] mt-1">{phaseLabel}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <button
          onClick={reset}
          className="p-3 rounded-full bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"
          title={t('common.reset')}
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          onClick={isRunning ? pause : start}
          className="p-4 rounded-full btn-primary"
        >
          {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </button>
        <button
          onClick={skip}
          className="p-3 rounded-full bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"
          title={t('common.next')}
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-6 text-center text-sm">
        <div>
          <div className="text-2xl font-bold text-[var(--accent-text)]">{sessionsCompleted}</div>
          <div className="text-[var(--text-muted)]">{t('analytics.studySessions')}</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[var(--text-heading)]">{Math.round(sessionsCompleted * settings.workDuration / 60)}</div>
          <div className="text-[var(--text-muted)]">min</div>
        </div>
      </div>

      {/* Duration Settings */}
      <div className="glass-card p-4 mt-8">
        <h3 className="font-semibold text-[var(--text-heading)] mb-3">{t('focus.settings')}</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">{t('focus.workDuration')}</label>
            <input
              type="number"
              value={settings.workDuration / 60}
              onChange={e => updateSettings({ workDuration: Number(e.target.value) * 60 })}
              min={1}
              max={120}
              className="input-field w-full text-center"
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">{t('focus.shortBreakDuration')}</label>
            <input
              type="number"
              value={settings.shortBreakDuration / 60}
              onChange={e => updateSettings({ shortBreakDuration: Number(e.target.value) * 60 })}
              min={1}
              max={30}
              className="input-field w-full text-center"
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">{t('focus.longBreakDuration')}</label>
            <input
              type="number"
              value={settings.longBreakDuration / 60}
              onChange={e => updateSettings({ longBreakDuration: Number(e.target.value) * 60 })}
              min={1}
              max={60}
              className="input-field w-full text-center"
              disabled={isRunning}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
