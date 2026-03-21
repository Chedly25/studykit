import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, Link } from 'react-router-dom'
import { ListChecks, Filter, Star, Check, Clock, Send, Bot, RotateCcw, Loader2 } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { useExerciseBank } from '../hooks/useExerciseBank'
import { useExerciseAI } from '../hooks/useExerciseAI'
import type { Exercise } from '../db/schema'

function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= level ? 'fill-amber-400 text-amber-400' : 'text-[var(--border-card)]'}`} />
      ))}
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500/15 text-green-600' : score >= 40 ? 'bg-amber-500/15 text-amber-600' : 'bg-red-500/15 text-red-600'
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${color}`}>
      {score}/100
    </span>
  )
}

function ExerciseCard({ exercise, examSourceName, topicNames, onClick }: {
  exercise: Exercise
  examSourceName: string
  topicNames: string[]
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="glass-card p-4 cursor-pointer hover:ring-1 hover:ring-[var(--accent-text)]/20 transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[var(--accent-text)]">Ex. {exercise.exerciseNumber}</span>
          <span className="text-xs text-[var(--text-muted)]">{examSourceName}</span>
        </div>
        <div className="flex items-center gap-2">
          <DifficultyStars level={exercise.difficulty} />
          {exercise.status === 'completed' && <Check className="w-4 h-4 text-green-500" />}
          {exercise.status === 'attempted' && <Clock className="w-4 h-4 text-amber-500" />}
        </div>
      </div>

      <p className="text-sm text-[var(--text-body)] line-clamp-3 mb-2">{exercise.text}</p>

      <div className="flex flex-wrap gap-1">
        {topicNames.map((name, i) => (
          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent-text)]">
            {name}
          </span>
        ))}
      </div>

      {exercise.lastAttemptScore != null && (
        <div className="mt-2 text-xs text-[var(--text-muted)]">
          Last score: {Math.round(exercise.lastAttemptScore * 100)}% · {exercise.attemptCount} attempt{exercise.attemptCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default function Exercises() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, chapters, topics, getChaptersForSubject, getTopicsForChapter } = useKnowledgeGraph(profileId)
  const { exercises, examSources } = useExerciseBank(profileId)
  const exerciseAI = useExerciseAI(profileId)

  const [filterSubject, setFilterSubject] = useState('')
  const [filterChapter, setFilterChapter] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState(0)
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [userAnswer, setUserAnswer] = useState('')

  // URL param: ?topic=TopicName → auto-filter
  useEffect(() => {
    const topicParam = searchParams.get('topic')
    if (topicParam && topics.length > 0) {
      const matchedTopic = topics.find(t => t.name.toLowerCase() === topicParam.toLowerCase())
      if (matchedTopic) {
        setFilterTopic(matchedTopic.id)
      }
    }
  }, [searchParams, topics])

  const topicMap = useMemo(() => new Map(topics.map(t => [t.id, t.name])), [topics])
  const examSourceMap = useMemo(() => new Map(examSources.map(s => [s.id, s.name])), [examSources])

  const filteredChapters = filterSubject
    ? getChaptersForSubject(filterSubject)
    : chapters

  const filteredTopicOptions = filterChapter
    ? getTopicsForChapter(filterChapter)
    : topics

  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      if (filterStatus && ex.status !== filterStatus) return false
      if (filterDifficulty && ex.difficulty !== filterDifficulty) return false
      if (filterTopic) {
        try {
          const ids: string[] = JSON.parse(ex.topicIds)
          if (!ids.includes(filterTopic)) return false
        } catch { return false }
      }
      if (filterChapter && !filterTopic) {
        try {
          const ids: string[] = JSON.parse(ex.topicIds)
          const chapterTopicIds = getTopicsForChapter(filterChapter).map(t => t.id)
          if (!ids.some(id => chapterTopicIds.includes(id))) return false
        } catch { return false }
      }
      if (filterSubject && !filterChapter && !filterTopic) {
        try {
          const ids: string[] = JSON.parse(ex.topicIds)
          const subjectTopicIds = topics.filter(t => t.subjectId === filterSubject).map(t => t.id)
          if (!ids.some(id => subjectTopicIds.includes(id))) return false
        } catch { return false }
      }
      return true
    }).sort((a, b) => a.difficulty - b.difficulty)
  }, [exercises, filterStatus, filterDifficulty, filterTopic, filterChapter, filterSubject, topics, getTopicsForChapter])

  const getTopicNames = (ex: Exercise): string[] => {
    try {
      const ids: string[] = JSON.parse(ex.topicIds)
      return ids.map(id => topicMap.get(id) ?? 'Unknown').slice(0, 3)
    } catch { return [] }
  }

  const handleCheckWithAI = () => {
    if (!selectedExercise || !userAnswer.trim()) return
    const topicNames = getTopicNames(selectedExercise)
    exerciseAI.checkAnswer(selectedExercise, userAnswer, topicNames)
  }

  const handleTryAgain = () => {
    setUserAnswer('')
    exerciseAI.reset()
  }

  const handleBack = () => {
    setSelectedExercise(null)
    setUserAnswer('')
    exerciseAI.reset()
  }

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <ListChecks className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('exercises.title', 'Exercise Bank')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.createProfileFirst')}</p>
        <Link to="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">Create Profile</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-heading)] flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-[var(--accent-text)]" /> {t('exercises.title', 'Exercise Bank')}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {exercises.length} exercises from {examSources.length} exam{examSources.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">{t('exercises.filters', 'Filters')}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select
            value={filterSubject}
            onChange={e => { setFilterSubject(e.target.value); setFilterChapter(''); setFilterTopic('') }}
            className="text-xs bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-2 py-1.5 text-[var(--text-body)]"
          >
            <option value="">All subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={filterChapter}
            onChange={e => { setFilterChapter(e.target.value); setFilterTopic('') }}
            className="text-xs bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-2 py-1.5 text-[var(--text-body)]"
          >
            <option value="">All chapters</option>
            {filteredChapters.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
          </select>
          <select
            value={filterTopic}
            onChange={e => setFilterTopic(e.target.value)}
            className="text-xs bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-2 py-1.5 text-[var(--text-body)]"
          >
            <option value="">All topics</option>
            {filteredTopicOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-2 py-1.5 text-[var(--text-body)]"
          >
            <option value="">All status</option>
            <option value="not_attempted">Not attempted</option>
            <option value="attempted">Attempted</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Exercise list or work mode */}
      {selectedExercise ? (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--accent-text)]">Exercise {selectedExercise.exerciseNumber}</span>
              <span className="text-xs text-[var(--text-muted)]">{examSourceMap.get(selectedExercise.examSourceId) ?? ''}</span>
              <DifficultyStars level={selectedExercise.difficulty} />
            </div>
            <button
              onClick={handleBack}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)]"
            >
              {t('common.back', 'Back')}
            </button>
          </div>

          <div className="prose prose-sm max-w-none mb-6 text-[var(--text-body)]">
            <p className="whitespace-pre-wrap">{selectedExercise.text}</p>
          </div>

          <div className="border-t border-[var(--border-card)] pt-4">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
              {t('exercises.yourWork', 'Your approach / answer')}
            </label>
            <textarea
              value={userAnswer}
              onChange={e => setUserAnswer(e.target.value)}
              placeholder={t('exercises.answerPlaceholder', 'Describe your approach or write your answer here...')}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-body)] placeholder:text-[var(--text-muted)]/50 min-h-[120px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
              disabled={exerciseAI.isStreaming}
            />

            {/* Action buttons */}
            {!exerciseAI.feedback && !exerciseAI.isStreaming && (
              <button
                onClick={handleCheckWithAI}
                disabled={!userAnswer.trim() || exerciseAI.isStreaming}
                className="mt-3 btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <Send className="w-4 h-4" /> {t('exercises.checkWithAI', 'Check with AI')}
              </button>
            )}
          </div>

          {/* AI Feedback */}
          {(exerciseAI.isStreaming || exerciseAI.feedback) && (
            <div className="mt-4 border-t border-[var(--border-card)] pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-[var(--accent-text)]" />
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">AI Feedback</span>
                {exerciseAI.isStreaming && <Loader2 className="w-3 h-3 text-[var(--accent-text)] animate-spin" />}
              </div>

              {exerciseAI.score !== null && (
                <div className="flex items-center gap-3 mb-3">
                  <ScoreBadge score={exerciseAI.score} />
                  {exerciseAI.errorType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)]">
                      {exerciseAI.errorType} error
                    </span>
                  )}
                </div>
              )}

              <div className="prose prose-sm max-w-none text-[var(--text-body)]">
                <p className="whitespace-pre-wrap">{exerciseAI.feedback}</p>
              </div>

              {!exerciseAI.isStreaming && (
                <button
                  onClick={handleTryAgain}
                  className="mt-3 px-4 py-2 text-sm flex items-center gap-2 rounded-lg border border-[var(--border-card)] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> Try again
                </button>
              )}
            </div>
          )}

          {/* Error */}
          {exerciseAI.error && (
            <div className="mt-3 text-sm text-red-500 bg-red-500/10 rounded-lg p-3">
              {exerciseAI.error}
            </div>
          )}

          {selectedExercise.solutionText && (
            <details className="mt-4 border-t border-[var(--border-card)] pt-4">
              <summary className="text-xs font-medium text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-body)]">
                {t('exercises.showSolution', 'Show solution')}
              </summary>
              <div className="mt-2 prose prose-sm max-w-none text-[var(--text-body)]">
                <p className="whitespace-pre-wrap">{selectedExercise.solutionText}</p>
              </div>
            </details>
          )}
        </div>
      ) : (
        <>
          {filteredExercises.length === 0 ? (
            <div className="text-center py-12">
              <ListChecks className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">
                {exercises.length === 0
                  ? <>No exercises yet. Upload past exams from the <Link to="/sources" className="text-[var(--accent-text)] hover:underline">Sources page</Link> to build your exercise bank.</>
                  : t('exercises.noMatch', 'No exercises match your filters.')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExercises.map(ex => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  examSourceName={examSourceMap.get(ex.examSourceId) ?? ''}
                  topicNames={getTopicNames(ex)}
                  onClick={() => setSelectedExercise(ex)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
