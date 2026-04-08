import { useState, useEffect, useCallback, useRef } from 'react'
import { Play, Pause, RotateCcw, SkipForward, Settings, ChevronDown, ChevronUp } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'
import { formatTime, loadFromStorage, saveToStorage } from '../../lib/timerUtils'

const tool = getToolBySlug('pomodoro-timer')!

type Mode = 'work' | 'shortBreak' | 'longBreak'

interface PomodoroSettings {
  workDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  longBreakInterval: number
}

interface DailyStats {
  date: string
  sessions: number
  totalMinutes: number
}

const STATS_KEY = 'studieskit-pomodoro-stats'

const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function getModeLabel(mode: Mode): string {
  switch (mode) {
    case 'work': return 'Focus'
    case 'shortBreak': return 'Short Break'
    case 'longBreak': return 'Long Break'
  }
}

function getModeColor(mode: Mode): { ring: string; text: string; bg: string } {
  switch (mode) {
    case 'work':
      return { ring: 'stroke-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' }
    case 'shortBreak':
      return { ring: 'stroke-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10' }
    case 'longBreak':
      return { ring: 'stroke-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/10' }
  }
}

function getDurationForMode(mode: Mode, settings: PomodoroSettings): number {
  switch (mode) {
    case 'work': return settings.workDuration * 60
    case 'shortBreak': return settings.shortBreakDuration * 60
    case 'longBreak': return settings.longBreakDuration * 60
  }
}

export default function PomodoroTimer() {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS)
  const [mode, setMode] = useState<Mode>('work')
  const [timeLeft, setTimeLeft] = useState(settings.workDuration * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [stats, setStats] = useState<DailyStats>(() =>
    loadFromStorage<DailyStats>(STATS_KEY, { date: getTodayKey(), sessions: 0, totalMinutes: 0 })
  )

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const today = getTodayKey()
    if (stats.date !== today) {
      const fresh: DailyStats = { date: today, sessions: 0, totalMinutes: 0 }
      setStats(fresh)
      saveToStorage(STATS_KEY, fresh)
    }
  }, [stats.date])

  useEffect(() => {
    saveToStorage(STATS_KEY, stats)
  }, [stats])

  const totalDuration = getDurationForMode(mode, settings)
  const colors = getModeColor(mode)

  const advancePhase = useCallback(() => {
    if (mode === 'work') {
      const newSessions = sessionsCompleted + 1
      setSessionsCompleted(newSessions)
      setStats(prev => ({
        ...prev,
        sessions: prev.sessions + 1,
        totalMinutes: prev.totalMinutes + settings.workDuration,
      }))
      if (newSessions % settings.longBreakInterval === 0) {
        setMode('longBreak')
        setTimeLeft(settings.longBreakDuration * 60)
      } else {
        setMode('shortBreak')
        setTimeLeft(settings.shortBreakDuration * 60)
      }
    } else {
      setMode('work')
      setTimeLeft(settings.workDuration * 60)
    }
    setIsRunning(false)
  }, [mode, sessionsCompleted, settings])

  const advancePhaseRef = useRef(advancePhase)
  useEffect(() => { advancePhaseRef.current = advancePhase }, [advancePhase])

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          advancePhaseRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRunning])

  const handleStartPause = () => setIsRunning(prev => !prev)

  const handleReset = () => {
    setIsRunning(false)
    setTimeLeft(getDurationForMode(mode, settings))
  }

  const handleSkip = () => {
    setIsRunning(false)
    advancePhase()
  }

  const handleSettingChange = (key: keyof PomodoroSettings, value: number) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    if (!isRunning) {
      setTimeLeft(getDurationForMode(mode, next))
    }
  }

  const RADIUS = 90
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const progress = timeLeft / totalDuration
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress)

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        {/* Mode tabs */}
        <div className="flex justify-center gap-2 mb-8">
          {(['work', 'shortBreak', 'longBreak'] as Mode[]).map(m => {
            const c = getModeColor(m)
            return (
              <button
                key={m}
                onClick={() => {
                  setIsRunning(false)
                  setMode(m)
                  setTimeLeft(getDurationForMode(m, settings))
                }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  mode === m ? `${c.bg} ${c.text}` : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
                }`}
              >
                {getModeLabel(m)}
              </button>
            )
          })}
        </div>

        {/* Circular timer */}
        <div className="flex justify-center mb-8">
          <div className="relative w-64 h-64">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                className="text-[var(--border-card)]"
                strokeWidth="6"
              />
              <circle
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                className={colors.ring}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`font-[family-name:var(--font-display)] text-5xl font-bold ${colors.text}`}>
                {formatTime(timeLeft)}
              </span>
              <span className="text-[var(--text-muted)] text-sm mt-1">{getModeLabel(mode)}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3 mb-6">
          <button onClick={handleReset} className="btn-secondary p-3 rounded-lg" aria-label="Reset">
            <RotateCcw size={20} />
          </button>
          <button
            onClick={handleStartPause}
            className="btn-primary px-8 py-3 rounded-lg flex items-center gap-2 text-lg font-medium"
          >
            {isRunning ? <Pause size={20} /> : <Play size={20} />}
            {isRunning ? 'Pause' : 'Start'}
          </button>
          <button onClick={handleSkip} className="btn-secondary p-3 rounded-lg" aria-label="Skip to next phase">
            <SkipForward size={20} />
          </button>
        </div>

        {/* Session counter & daily stats */}
        <div className="glass-card p-4 mb-6">
          <div className="flex justify-around text-center">
            <div>
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Sessions</p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
                {sessionsCompleted}
              </p>
            </div>
            <div className="w-px bg-[var(--border-card)]" />
            <div>
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Today</p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
                {stats.sessions} <span className="text-sm font-normal text-[var(--text-muted)]">sessions</span>
              </p>
            </div>
            <div className="w-px bg-[var(--border-card)]" />
            <div>
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Focus Time</p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
                {stats.totalMinutes} <span className="text-sm font-normal text-[var(--text-muted)]">min</span>
              </p>
            </div>
          </div>
        </div>

        {/* Settings panel */}
        <div className="glass-card overflow-hidden">
          <button
            onClick={() => setShowSettings(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 text-[var(--text-body)] hover:text-[var(--text-heading)] transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Settings size={16} />
              Timer Settings
            </span>
            {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showSettings && (
            <div className="px-4 pb-4 space-y-4 border-t border-[var(--border-card)]">
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-1">
                    Work Duration (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={settings.workDuration}
                    onChange={e => handleSettingChange('workDuration', Math.max(1, parseInt(e.target.value) || 1))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-1">
                    Short Break (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={settings.shortBreakDuration}
                    onChange={e => handleSettingChange('shortBreakDuration', Math.max(1, parseInt(e.target.value) || 1))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-1">
                    Long Break (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={settings.longBreakDuration}
                    onChange={e => handleSettingChange('longBreakDuration', Math.max(1, parseInt(e.target.value) || 1))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-1">
                    Sessions Before Long Break
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={settings.longBreakInterval}
                    onChange={e => handleSettingChange('longBreakInterval', Math.max(2, parseInt(e.target.value) || 2))}
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </FormToolPage>
    </>
  )
}
