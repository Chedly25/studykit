import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Clock, ArrowRight, Sparkles } from 'lucide-react'
import type { StudyRecommendation } from '../../lib/studyRecommender'

interface Props {
  recommendations: StudyRecommendation[]
  dueFlashcardCount: number
  hasTopics: boolean
}

const TIME_OPTIONS = [15, 30, 60, 120] as const

interface StudyOption {
  letter: string
  title: string
  detail: string
  tradeoff: string
  actions: Array<{ label: string; to: string }>
}

export function DecisionConsoleCard({ recommendations, dueFlashcardCount, hasTopics }: Props) {
  const { t } = useTranslation()
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [showOptions, setShowOptions] = useState(false)

  if (!hasTopics) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-[var(--accent-text)]" />
          <h3 className="font-semibold text-[var(--text-heading)]">{t('dashboard.decisionConsole')}</h3>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          {t('dashboard.landscapeEmpty')}
        </p>
      </div>
    )
  }

  // Build options from recommendations, tailored to selected time
  const options: StudyOption[] = []
  const isShortSession = selectedTime !== null && selectedTime <= 30

  // Option A: Deepest need topic
  if (recommendations.length > 0) {
    const top = recommendations[0]
    const daysSinceStr = top.reason.toLowerCase().includes('decay')
      ? ' — depth has decayed'
      : ` — ${Math.round(top.decayedMastery * 100)}% depth`
    options.push({
      letter: 'A',
      title: `Deepen "${top.topicName}"`,
      detail: `${top.subjectName}${daysSinceStr}`,
      tradeoff: isShortSession
        ? 'May be too dense for a short session — skim key concepts'
        : top.decayedMastery < 0.3
          ? 'Highest impact but may be dense material'
          : 'Good balance of depth-building and reinforcement',
      actions: isShortSession
        ? [{ label: 'Quick Review', to: '/chat' }]
        : [
            { label: 'Start Reading', to: '/sources' },
            { label: 'Practice Questions', to: '/practice-exam' },
          ],
    })
  }

  // Option B: Flashcard review (if due)
  if (dueFlashcardCount > 0) {
    options.push({
      letter: options.length === 0 ? 'A' : 'B',
      title: `Review ${dueFlashcardCount} due flashcards`,
      detail: 'Retention may be dropping on some topics',
      tradeoff: isShortSession
        ? 'Perfect fit for a short session'
        : 'Quick wins for retention, no new depth',
      actions: [
        { label: 'Start Review', to: '/flashcard-maker' },
      ],
    })
  }

  // Option C: Continue recent work (second recommendation)
  if (recommendations.length > 1) {
    const rec = recommendations[1]
    options.push({
      letter: String.fromCharCode(65 + options.length),
      title: `Continue "${rec.topicName}"`,
      detail: `${rec.subjectName} — ${Math.round(rec.decayedMastery * 100)}% depth`,
      tradeoff: 'Reinforces recent work, good for retention',
      actions: [
        { label: 'Continue Studying', to: rec.linkTo },
      ],
    })
  }

  const formatTime = (mins: number) => mins >= 60 ? `${mins / 60}h` : `${mins}m`

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-[var(--accent-text)]" />
        <h3 className="font-semibold text-[var(--text-heading)]">{t('dashboard.decisionConsole')}</h3>
      </div>

      {!showOptions ? (
        <div>
          <p className="text-sm text-[var(--text-body)] mb-3">{t('dashboard.decisionConsolePrompt')}</p>

          <div className="flex items-center gap-2 mb-3">
            {TIME_OPTIONS.map(mins => (
              <button
                key={mins}
                onClick={() => setSelectedTime(mins)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedTime === mins
                    ? 'bg-[var(--accent-text)] text-white'
                    : 'bg-[var(--accent-bg)] text-[var(--accent-text)] hover:bg-[var(--accent-text)] hover:text-white'
                }`}
              >
                {formatTime(mins)}
              </button>
            ))}
          </div>

          {selectedTime && (
            <button
              onClick={() => setShowOptions(true)}
              className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
            >
              {t('dashboard.showOptions')}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="space-y-3">
            {options.slice(0, 3).map(option => (
              <div key={option.letter} className="p-3 rounded-lg border border-[var(--border-card)] hover:border-[var(--accent-text)] transition-colors">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-[var(--accent-text)] bg-[var(--accent-bg)] px-2 py-0.5 rounded mt-0.5 shrink-0">
                    {t('dashboard.optionLabel', { letter: option.letter })}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-heading)]">{option.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{option.detail}</p>
                    <p className="text-xs text-[var(--text-faint)] mt-1 italic">
                      {t('dashboard.tradeoff')}: {option.tradeoff}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {option.actions.map(action => (
                        <Link
                          key={action.to}
                          to={action.to}
                          className="text-xs font-medium text-[var(--accent-text)] hover:underline"
                        >
                          [{action.label}]
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-3">
            <button
              onClick={() => { setShowOptions(false); setSelectedTime(null) }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
            >
              {t('common.back')}
            </button>
            <Link
              to="/study-plan"
              className="text-xs text-[var(--text-faint)] hover:text-[var(--accent-text)] transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              {t('dashboard.letAiDecide')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
