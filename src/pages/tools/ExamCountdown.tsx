import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X, CheckCircle, CalendarClock } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'
import { loadFromStorage, saveToStorage } from '../../lib/timerUtils'

const tool = getToolBySlug('exam-countdown')!

const STORAGE_KEY = 'studykit-exams'

interface Exam {
  id: string
  name: string
  date: string // ISO date string YYYY-MM-DD
}

interface TimeRemaining {
  days: number
  hours: number
  minutes: number
  seconds: number
  isPast: boolean
}

function getTimeRemaining(targetDate: string): TimeRemaining {
  const now = Date.now()
  const target = new Date(targetDate + 'T23:59:59').getTime()
  const diff = target - now

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true }
  }

  const seconds = Math.floor(diff / 1000) % 60
  const minutes = Math.floor(diff / (1000 * 60)) % 60
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  return { days, hours, minutes, seconds, isPast: false }
}

export default function ExamCountdown() {
  const [exams, setExams] = useState<Exam[]>(() =>
    loadFromStorage<Exam[]>(STORAGE_KEY, [])
  )
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState('')
  const [, setTick] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Persist exams
  useEffect(() => {
    saveToStorage(STORAGE_KEY, exams)
  }, [exams])

  // Tick every second so countdowns update
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTick(prev => prev + 1)
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const addExam = useCallback(() => {
    const trimmed = newName.trim()
    if (!trimmed || !newDate) return
    const exam: Exam = {
      id: Date.now().toString(),
      name: trimmed,
      date: newDate,
    }
    setExams(prev => [...prev, exam])
    setNewName('')
    setNewDate('')
  }, [newName, newDate])

  const removeExam = useCallback((id: string) => {
    setExams(prev => prev.filter(e => e.id !== id))
  }, [])

  // Sort: upcoming first (by date ascending), past exams at bottom
  const sortedExams = [...exams].sort((a, b) => {
    const aTime = getTimeRemaining(a.date)
    const bTime = getTimeRemaining(b.date)
    if (aTime.isPast !== bTime.isPast) return aTime.isPast ? 1 : -1
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  // Minimum date for new exams: today
  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        {/* Add exam form */}
        <div className="glass-card p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Exam name (e.g. Math Final)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addExam() }}
              className="input-field flex-1"
            />
            <input
              type="date"
              value={newDate}
              min={todayStr}
              onChange={e => setNewDate(e.target.value)}
              className="input-field sm:w-44"
            />
            <button
              onClick={addExam}
              disabled={!newName.trim() || !newDate}
              className="btn-primary px-5 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        {/* Exam countdown cards */}
        {sortedExams.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <CalendarClock size={40} className="text-surface-600 mx-auto mb-3" />
            <p className="text-surface-400">No exams added yet. Add your first exam above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedExams.map(exam => {
              const time = getTimeRemaining(exam.date)

              return (
                <div
                  key={exam.id}
                  className={`glass-card p-4 flex items-center justify-between transition-opacity ${
                    time.isPast ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-surface-100 truncate">
                      {exam.name}
                    </h3>
                    <p className="text-surface-500 text-xs mt-0.5">
                      {new Date(exam.date + 'T00:00:00').toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>

                    {time.isPast ? (
                      <div className="flex items-center gap-1.5 mt-2 text-emerald-400">
                        <CheckCircle size={16} />
                        <span className="text-sm font-medium">Completed</span>
                      </div>
                    ) : (
                      <div className="flex gap-4 mt-2">
                        <CountdownUnit value={time.days} label="days" />
                        <CountdownUnit value={time.hours} label="hrs" />
                        <CountdownUnit value={time.minutes} label="min" />
                        <CountdownUnit value={time.seconds} label="sec" />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => removeExam(exam.id)}
                    className="p-2 text-surface-500 hover:text-red-400 transition-colors ml-3 shrink-0"
                    aria-label={`Remove ${exam.name}`}
                  >
                    <X size={18} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </FormToolPage>
    </>
  )
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="font-[family-name:var(--font-display)] text-xl font-bold text-primary-400">
        {value}
      </p>
      <p className="text-surface-500 text-xs">{label}</p>
    </div>
  )
}
