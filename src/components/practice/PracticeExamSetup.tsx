import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Play, Clock, Sparkles, X, Shield } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import type { Subject, Topic } from '../../db/schema'
import { SourcesToggle } from '../sources/SourcesToggle'
import type { PracticeExamOptions } from '../../hooks/usePracticeExam'

interface PracticeExamSetupProps {
  examProfileId: string
  subjects: Subject[]
  topics: Topic[]
  weakTopics: Topic[]
  documentCount: number
  onStart: (options: PracticeExamOptions) => void
}

export function PracticeExamSetup({
  examProfileId,
  subjects,
  topics,
  weakTopics,
  documentCount,
  onStart,
}: PracticeExamSetupProps) {
  const { t } = useTranslation()
  const [questionCount, setQuestionCount] = useState(10)
  const [focusSubject, setFocusSubject] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [customFocus, setCustomFocus] = useState('')
  const [examSection, setExamSection] = useState('')
  const [sourcesEnabled, setSourcesEnabled] = useState(false)
  const hasUserToggledSources = useRef(false)

  useEffect(() => {
    hasUserToggledSources.current = false
  }, [examProfileId])

  useEffect(() => {
    if (!hasUserToggledSources.current && documentCount > 0) {
      setSourcesEnabled(true)
    }
  }, [documentCount])

  const handleToggleSources = (v: boolean) => {
    hasUserToggledSources.current = true
    setSourcesEnabled(v)
  }

  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(30)
  const [proctorMode, setProctorMode] = useState(false)

  const examFormats = useLiveQuery(
    () => db.examFormats.where('examProfileId').equals(examProfileId).toArray(),
    [examProfileId],
  ) ?? []

  // Topics for the selected subject (or all if none selected)
  const availableTopics = useMemo(() => {
    if (!focusSubject) return topics
    const subject = subjects.find(s => s.name === focusSubject)
    return subject ? topics.filter(t => t.subjectId === subject.id) : topics
  }, [focusSubject, subjects, topics])

  const toggleTopic = (topicName: string) => {
    setSelectedTopics(prev =>
      prev.includes(topicName)
        ? prev.filter(t => t !== topicName)
        : [...prev, topicName]
    )
  }

  const addWeakTopics = () => {
    const weakNames = weakTopics.slice(0, 5).map(t => t.name)
    setSelectedTopics(prev => {
      const combined = new Set([...prev, ...weakNames])
      return Array.from(combined)
    })
  }

  const handleStart = () => {
    onStart({
      questionCount,
      focusSubject: focusSubject || undefined,
      selectedTopics: selectedTopics.length > 0 ? selectedTopics : undefined,
      customFocus: customFocus.trim() || undefined,
      examSection: examSection || undefined,
      sourcesEnabled,
      timeLimitSeconds: timerEnabled ? timerMinutes * 60 : undefined,
      proctorMode: proctorMode || undefined,
    })
  }

  const estimatedCalls = 3

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="text-center mb-8">
        <BarChart3 className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-2">{t('ai.practiceSession')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.practiceSubtitle')}</p>
      </div>

      <div className="glass-card p-6 space-y-5">
        {/* Custom focus — free text for specific requests */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
            {t('practiceExam.customFocus')}
          </label>
          <input
            type="text"
            value={customFocus}
            onChange={e => setCustomFocus(e.target.value)}
            placeholder={t('practiceExam.customFocusPlaceholder')}
            className="input-field w-full"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {t('practiceExam.customFocusHint')}
          </p>
        </div>

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

        {/* Focus area — subject level */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
            {t('ai.focusArea')}
          </label>
          <select
            value={focusSubject}
            onChange={e => { setFocusSubject(e.target.value); setSelectedTopics([]) }}
            className="select-field w-full"
          >
            <option value="">{t('ai.autoWeakest')}</option>
            {subjects.map(s => (
              <option key={s.id} value={s.name}>{s.name} — {Math.round(s.mastery * 100)}%</option>
            ))}
          </select>
        </div>

        {/* Topic selection — pills */}
        {availableTopics.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[var(--text-body)]">
                {t('practiceExam.selectTopics')}
              </label>
              {selectedTopics.length > 0 && (
                <button
                  onClick={() => setSelectedTopics([])}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
                >
                  {t('practiceExam.clearSelection')}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTopics.map(topic => {
                const isSelected = selectedTopics.includes(topic.name)
                const isWeak = weakTopics.some(w => w.id === topic.id)
                return (
                  <button
                    key={topic.id}
                    onClick={() => toggleTopic(topic.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-[var(--accent-text)] text-white'
                        : isWeak
                        ? 'border border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:border-amber-400'
                        : 'border border-[var(--border-card)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
                    }`}
                  >
                    {topic.name}
                    {isSelected && <X className="inline w-3 h-3 ml-1" />}
                    {!isSelected && isWeak && <span className="ml-1 opacity-60">{Math.round(topic.mastery * 100)}%</span>}
                  </button>
                )
              })}
            </div>
            {selectedTopics.length > 0 && (
              <p className="text-xs text-[var(--accent-text)] mt-1.5">
                {t('practiceExam.topicsSelected', { count: selectedTopics.length })}
              </p>
            )}
          </div>
        )}

        {/* AI suggestions — weak topics quick-add */}
        {weakTopics.length > 0 && selectedTopics.length === 0 && !customFocus && (
          <button
            onClick={addWeakTopics}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-[var(--accent-text)]/30 text-sm text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {t('practiceExam.suggestWeakTopics', {
              topics: weakTopics.slice(0, 3).map(t => t.name).join(', ')
            })}
          </button>
        )}

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
          <SourcesToggle enabled={sourcesEnabled} onToggle={handleToggleSources} documentCount={documentCount} />
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
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>
        )}

        {/* Proctor Mode */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-[var(--text-body)] flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {t('practiceExam.proctorMode')}
            </label>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('practiceExam.proctorModeHint')}
            </p>
          </div>
          <button
            onClick={() => setProctorMode(!proctorMode)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              proctorMode ? 'bg-[var(--accent-text)]' : 'bg-[var(--bg-input)] border border-[var(--border-card)]'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              proctorMode ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>

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
