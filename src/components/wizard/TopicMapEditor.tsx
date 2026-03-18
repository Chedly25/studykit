import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { useState } from 'react'
import type { DraftSubject, DraftTopic, WizardAction } from '../../hooks/useWizardDraft'

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4']

interface TopicMapEditorProps {
  subjects: DraftSubject[]
  dispatch: React.Dispatch<WizardAction>
}

export function TopicMapEditor({ subjects, dispatch }: TopicMapEditorProps) {
  const { t } = useTranslation()
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    () => new Set(subjects.slice(0, 2).map(s => s.tempId))
  )

  const toggleExpand = useCallback((tempId: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev)
      if (next.has(tempId)) next.delete(tempId)
      else next.add(tempId)
      return next
    })
  }, [])

  const addSubject = useCallback(() => {
    const tempId = crypto.randomUUID()
    dispatch({
      type: 'ADD_SUBJECT',
      subject: {
        tempId,
        name: '',
        weight: Math.round(100 / (subjects.length + 1)),
        color: COLORS[subjects.length % COLORS.length],
        topics: [],
      },
    })
    setExpandedSubjects(prev => new Set(prev).add(tempId))
  }, [subjects.length, dispatch])

  const addTopic = useCallback((subjectTempId: string) => {
    dispatch({
      type: 'ADD_TOPIC',
      subjectTempId,
      topic: { tempId: crypto.randomUUID(), name: '' },
    })
  }, [dispatch])

  const totalWeight = subjects.reduce((sum, s) => sum + s.weight, 0)

  return (
    <div className="space-y-3">
      {subjects.map((subject) => {
        const isExpanded = expandedSubjects.has(subject.tempId)
        return (
          <div key={subject.tempId} className="border border-[var(--border-card)] rounded-xl overflow-hidden">
            {/* Subject Header */}
            <div className="flex items-center gap-2 p-3 bg-[var(--bg-card)]">
              <button
                onClick={() => toggleExpand(subject.tempId)}
                className="p-1 hover:bg-[var(--accent-bg)] rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </button>

              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: subject.color }}
              />

              <input
                type="text"
                value={subject.name}
                onChange={e => dispatch({
                  type: 'UPDATE_SUBJECT',
                  tempId: subject.tempId,
                  updates: { name: e.target.value },
                })}
                placeholder={t('profile.subjectName', 'Subject name')}
                className="flex-1 bg-transparent text-sm font-semibold text-[var(--text-heading)] placeholder:text-[var(--text-muted)]/50 focus:outline-none"
              />

              <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={subject.weight}
                  onChange={e => dispatch({
                    type: 'UPDATE_SUBJECT',
                    tempId: subject.tempId,
                    updates: { weight: Math.max(1, Number(e.target.value)) },
                  })}
                  className="w-12 bg-[var(--bg-input)] border border-[var(--border-card)] rounded px-1.5 py-0.5 text-center text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
                />
                <span>%</span>
              </div>

              <span className="text-xs text-[var(--text-muted)]">
                {subject.topics.length} {subject.topics.length === 1 ? 'topic' : 'topics'}
              </span>

              <button
                onClick={() => dispatch({ type: 'REMOVE_SUBJECT', tempId: subject.tempId })}
                className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Topics */}
            {isExpanded && (
              <div className="border-t border-[var(--border-card)]">
                {subject.topics.map((topic) => (
                  <div
                    key={topic.tempId}
                    className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-card)] last:border-b-0"
                  >
                    <GripVertical className="w-3 h-3 text-[var(--text-muted)]/40 flex-shrink-0" />
                    <input
                      type="text"
                      value={topic.name}
                      onChange={e => dispatch({
                        type: 'UPDATE_TOPIC',
                        subjectTempId: subject.tempId,
                        topicTempId: topic.tempId,
                        name: e.target.value,
                      })}
                      placeholder={t('profile.topicName', 'Topic name')}
                      className="flex-1 bg-transparent text-sm text-[var(--text-body)] placeholder:text-[var(--text-muted)]/50 focus:outline-none"
                    />
                    <button
                      onClick={() => dispatch({
                        type: 'REMOVE_TOPIC',
                        subjectTempId: subject.tempId,
                        topicTempId: topic.tempId,
                      })}
                      className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => addTopic(subject.tempId)}
                  className="w-full px-4 py-2 text-xs text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3" /> {t('profile.addTopic', 'Add topic')}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Add Subject */}
      <button
        onClick={addSubject}
        className="w-full glass-card p-3 text-sm font-medium text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> {t('profile.addSubject', 'Add subject')}
      </button>

      {/* Weight indicator */}
      {subjects.length > 0 && totalWeight !== 100 && (
        <p className="text-xs text-[var(--text-muted)] text-center">
          {t('wizard.weightsNote', 'Weights will auto-normalize to 100% on save')}
        </p>
      )}
    </div>
  )
}
