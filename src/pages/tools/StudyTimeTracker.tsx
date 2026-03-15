import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, Trash2, Play, Square, BarChart3 } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'
import { formatTimeHMS, loadFromStorage, saveToStorage } from '../../lib/timerUtils'

const tool = getToolBySlug('study-time-tracker')!

const STORAGE_KEY = 'studykit-study-tracker'

interface StudySession {
  date: string  // ISO YYYY-MM-DD
  seconds: number
}

interface Subject {
  id: string
  name: string
  sessions: StudySession[]
}

interface TrackerState {
  subjects: Subject[]
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function getWeekStart(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
  const start = new Date(now)
  start.setDate(diff)
  start.setHours(0, 0, 0, 0)
  return start
}

function totalSeconds(sessions: StudySession[]): number {
  return sessions.reduce((sum, s) => sum + s.seconds, 0)
}

function weekSeconds(sessions: StudySession[]): number {
  const start = getWeekStart()
  const startStr = start.toISOString().slice(0, 10)
  return sessions
    .filter(s => s.date >= startStr)
    .reduce((sum, s) => sum + s.seconds, 0)
}

export default function StudyTimeTracker() {
  const [data, setData] = useState<TrackerState>(() =>
    loadFromStorage<TrackerState>(STORAGE_KEY, { subjects: [] })
  )
  const [activeSubject, setActiveSubject] = useState<string | null>(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [newSubjectName, setNewSubjectName] = useState('')

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Persist data
  useEffect(() => {
    saveToStorage(STORAGE_KEY, data)
  }, [data])

  // Tick active timer
  useEffect(() => {
    if (!activeSubject) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setTimerSeconds(prev => prev + 1)
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [activeSubject])

  const addSubject = useCallback(() => {
    const trimmed = newSubjectName.trim()
    if (!trimmed) return
    const subject: Subject = {
      id: Date.now().toString(),
      name: trimmed,
      sessions: [],
    }
    setData(prev => ({ subjects: [...prev.subjects, subject] }))
    setNewSubjectName('')
  }, [newSubjectName])

  const removeSubject = useCallback((id: string) => {
    // If removing the active subject, stop timer and save
    if (activeSubject === id && timerSeconds > 0) {
      setData(prev => ({
        subjects: prev.subjects.map(s =>
          s.id === id
            ? { ...s, sessions: [...s.sessions, { date: getTodayKey(), seconds: timerSeconds }] }
            : s
        ),
      }))
      setActiveSubject(null)
      setTimerSeconds(0)
    } else if (activeSubject === id) {
      setActiveSubject(null)
      setTimerSeconds(0)
    }
    setData(prev => ({ subjects: prev.subjects.filter(s => s.id !== id) }))
  }, [activeSubject, timerSeconds])

  const toggleTimer = useCallback((id: string) => {
    if (activeSubject === id) {
      // Stop: save elapsed time as a session
      if (timerSeconds > 0) {
        setData(prev => ({
          subjects: prev.subjects.map(s =>
            s.id === id
              ? { ...s, sessions: [...s.sessions, { date: getTodayKey(), seconds: timerSeconds }] }
              : s
          ),
        }))
      }
      setActiveSubject(null)
      setTimerSeconds(0)
    } else {
      // Save any running timer first
      if (activeSubject && timerSeconds > 0) {
        setData(prev => ({
          subjects: prev.subjects.map(s =>
            s.id === activeSubject
              ? { ...s, sessions: [...s.sessions, { date: getTodayKey(), seconds: timerSeconds }] }
              : s
          ),
        }))
      }
      setActiveSubject(id)
      setTimerSeconds(0)
    }
  }, [activeSubject, timerSeconds])

  // Weekly chart data
  const weeklyData = useMemo(() => {
    return data.subjects.map(s => ({
      name: s.name,
      hours: weekSeconds(s.sessions) / 3600,
    }))
  }, [data.subjects])

  const maxWeeklyHours = useMemo(() => {
    return Math.max(1, ...weeklyData.map(d => d.hours))
  }, [weeklyData])

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        {/* Add subject form */}
        <div className="glass-card p-4 mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Subject name (e.g. Biology)"
              value={newSubjectName}
              onChange={e => setNewSubjectName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSubject() }}
              className="input-field flex-1"
            />
            <button
              onClick={addSubject}
              disabled={!newSubjectName.trim()}
              className="btn-primary px-5 py-2 rounded-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        {/* Active timer display */}
        {activeSubject && (
          <div className="glass-card p-4 mb-6 text-center">
            <p className="text-surface-400 text-sm mb-1">
              Studying: <span className="text-surface-200 font-medium">
                {data.subjects.find(s => s.id === activeSubject)?.name}
              </span>
            </p>
            <p className="font-[family-name:var(--font-display)] text-4xl font-bold text-emerald-400">
              {formatTimeHMS(timerSeconds)}
            </p>
          </div>
        )}

        {/* Subject cards */}
        {data.subjects.length === 0 ? (
          <div className="glass-card p-12 text-center mb-6">
            <BarChart3 size={40} className="text-surface-600 mx-auto mb-3" />
            <p className="text-surface-400">No subjects yet. Add one above to start tracking.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {data.subjects.map(subject => {
              const isActive = activeSubject === subject.id
              const allTime = totalSeconds(subject.sessions) + (isActive ? timerSeconds : 0)
              const thisWeek = weekSeconds(subject.sessions) + (isActive ? timerSeconds : 0)

              return (
                <div
                  key={subject.id}
                  className={`glass-card p-4 transition-all ${
                    isActive ? 'ring-1 ring-emerald-500/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-surface-100">
                      {subject.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleTimer(subject.id)}
                        className={`p-2 rounded-lg transition-all ${
                          isActive
                            ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                            : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                        }`}
                        aria-label={isActive ? 'Stop timer' : 'Start timer'}
                      >
                        {isActive ? <Square size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        onClick={() => removeSubject(subject.id)}
                        className="p-2 text-surface-500 hover:text-red-400 transition-colors"
                        aria-label={`Remove ${subject.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-6">
                    <div>
                      <p className="text-surface-500 text-xs uppercase tracking-wider">All Time</p>
                      <p className="text-surface-200 font-medium">{formatTimeHMS(allTime)}</p>
                    </div>
                    <div>
                      <p className="text-surface-500 text-xs uppercase tracking-wider">This Week</p>
                      <p className="text-surface-200 font-medium">{formatTimeHMS(thisWeek)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Weekly bar chart */}
        {weeklyData.length > 0 && weeklyData.some(d => d.hours > 0) && (
          <div className="glass-card p-4">
            <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">
              This Week
            </h3>
            <div className="space-y-3">
              {weeklyData.map(item => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-surface-300 text-sm w-28 truncate shrink-0">{item.name}</span>
                  <div className="flex-1 h-6 bg-surface-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500/60 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(item.hours > 0 ? 4 : 0, (item.hours / maxWeeklyHours) * 100)}%` }}
                    />
                  </div>
                  <span className="text-surface-400 text-xs w-14 text-right shrink-0">
                    {item.hours.toFixed(1)}h
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </FormToolPage>
    </>
  )
}
