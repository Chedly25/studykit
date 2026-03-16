import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Play, Clock } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import type { ExamFormat, Subject, Topic } from '../../db/schema'
import { SourcesToggle } from '../sources/SourcesToggle'
import type { PracticeExamOptions } from '../../hooks/usePracticeExam'

interface PracticeExamSetupProps {
  examProfileId: string
  subjects: Subject[]
  weakTopics: Topic[]
  documentCount: number
  onStart: (options: PracticeExamOptions) => void
}

export function PracticeExamSetup({
  examProfileId,
  subjects,
  weakTopics,
  documentCount,
  onStart,
}: PracticeExamSetupProps) {
  const { t } = useTranslation()
  const [questionCount, setQuestionCount] = useState(10)
  const [focusSubject, setFocusSubject] = useState('')
  const [examSection, setExamSection] = useState('')
  const [sourcesEnabled, setSourcesEnabled] = useState(false)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(30)

  const examFormats = useLiveQuery(
    () => db.examFormats.where('examProfileId').equals(examProfileId).toArray(),
    [examProfileId],
  ) ?? []

  const handleStart = () => {
    onStart({
      questionCount,
      focusSubject: focusSubject || undefined,
      examSection: examSection || undefined,
      sourcesEnabled,
      timeLimitSeconds: timerEnabled ? timerMinutes * 60 : undefined,
    })
  }

  // Estimate: ~3 LLM calls (generate + validate + grade feedback)
  const estimatedCalls = 3

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="text-center mb-8">
        <BarChart3 className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2">{t('ai.practiceSession')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.practiceSubtitle')}</p>
      </div>

      <div className="glass-card p-6 space-y-5">
        {/* Question count */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
            {t('ai.numberOfQuestions')}
          </label>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={questionCount}
            onChange={e => setQuestionCount(Number(e.target.value))}
            className="w-full accent-[var(--accent-text)]"
          />
          <div className="text-center text-lg font-semibold text-[var(--accent-text)]">{questionCount}</div>
        </div>

        {/* Focus area */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
            {t('ai.focusArea')}
          </label>
          <select
            value={focusSubject}
            onChange={e => setFocusSubject(e.target.value)}
            className="select-field w-full"
          >
            <option value="">{t('ai.autoWeakest')}</option>
            {subjects.map(s => (
              <option key={s.id} value={s.name}>{s.name} — {Math.round(s.mastery * 100)}%</option>
            ))}
          </select>
        </div>

        {/* Exam format section */}
        {examFormats.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
              {t('examFormat.title')}
            </label>
            <select
              value={examSection}
              onChange={e => setExamSection(e.target.value)}
              className="select-field w-full"
            >
              <option value="">All sections</option>
              {examFormats.map(f => (
                <option key={f.id} value={f.formatName}>{f.formatName} — {f.pointWeight}%</option>
              ))}
            </select>
          </div>
        )}

        {/* Sources toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--text-body)]">{t('ai.useSources')}</label>
          <SourcesToggle enabled={sourcesEnabled} onToggle={setSourcesEnabled} documentCount={documentCount} />
        </div>

        {/* Timer */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--text-body)] flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('practiceExam.timer')}
          </label>
          <button
            onClick={() => setTimerEnabled(!timerEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              timerEnabled ? 'bg-[var(--accent-text)]' : 'bg-[var(--bg-input)] border border-[var(--border-card)]'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              timerEnabled ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>

        {timerEnabled && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
              {t('practiceExam.timerDuration')}
            </label>
            <select
              value={timerMinutes}
              onChange={e => setTimerMinutes(Number(e.target.value))}
              className="select-field w-full"
            >
              {[10, 15, 20, 30, 45, 60, 90, 120].map(m => (
                <option key={m} value={m}>{m} {t('ai.minutes', { count: m }).replace(String(m), '').trim() || 'min'}</option>
              ))}
            </select>
          </div>
        )}

        {/* Weak areas hint */}
        {weakTopics.length > 0 && (
          <div className="text-xs text-[var(--text-muted)]">
            {t('ai.weakAreas')}: {weakTopics.slice(0, 3).map(t => t.name).join(', ')}
          </div>
        )}

        {/* API usage estimate */}
        <div className="text-xs text-[var(--text-muted)] text-center">
          {t('practiceExam.estimatedCalls', { count: estimatedCalls })}
        </div>

        {/* Start button */}
        <button onClick={handleStart} className="btn-primary px-6 py-2.5 w-full flex items-center justify-center gap-2">
          <Play className="w-4 h-4" /> {t('ai.startPractice')}
        </button>
      </div>
    </div>
  )
}
