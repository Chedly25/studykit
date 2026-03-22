/**
 * Compact card showing what the AI tutor has learned about the student.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Brain, ArrowRight } from 'lucide-react'
import type { StudentModel } from '../../db/schema'

interface Props {
  studentModel: StudentModel | undefined
}

function safeParse<T>(json: string | undefined | null, fallback: T): T {
  try { return JSON.parse(json || '') ?? fallback }
  catch { return fallback }
}

export function LearningProfileCard({ studentModel }: Props) {
  const { t } = useTranslation()
  if (!studentModel) return null

  const commonMistakes: string[] = safeParse(studentModel.commonMistakes, [])
  const preferredExplanations: string[] = safeParse(studentModel.preferredExplanations, [])
  const learningStyle = safeParse(studentModel.learningStyle, {} as Record<string, unknown>)

  const hasData = commonMistakes.length > 0 || preferredExplanations.length > 0 || Object.keys(learningStyle).length > 0
  if (!hasData) return null

  const updatedAt = studentModel.updatedAt
    ? formatRelativeTime(new Date(studentModel.updatedAt), t)
    : null

  return (
    <div className="glass-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t('dashboard.profileTitle')}</span>
        </div>
        <Link
          to="/analytics#insights"
          className="text-xs text-[var(--accent-text)] hover:underline flex items-center gap-1"
        >
          {t('dashboard.profileFullProfile')} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {commonMistakes.length > 0 && (
          <div>
            <span className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-wider">{t('dashboard.profileCommonMistakes')}</span>
            <ul className="mt-0.5">
              {commonMistakes.slice(0, 3).map((m, i) => (
                <li key={i} className="text-xs text-[var(--text-body)] truncate">- {m}</li>
              ))}
            </ul>
          </div>
        )}

        {preferredExplanations.length > 0 && (
          <div>
            <span className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-wider">{t('dashboard.profileWhatWorks')}</span>
            <ul className="mt-0.5">
              {preferredExplanations.slice(0, 2).map((p, i) => (
                <li key={i} className="text-xs text-[var(--text-body)] truncate">- {p}</li>
              ))}
            </ul>
          </div>
        )}

        {Object.keys(learningStyle).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(learningStyle).slice(0, 4).map(([key, value]) => (
              <span key={key} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 font-medium">
                {String(value) === 'true' ? key : `${key}: ${value}`}
              </span>
            ))}
          </div>
        )}
      </div>

      {updatedAt && (
        <p className="text-[10px] text-[var(--text-faint)] mt-2">{t('dashboard.profileUpdated', { time: updatedAt })}</p>
      )}
    </div>
  )
}

function formatRelativeTime(date: Date, t: (key: string, options?: Record<string, unknown>) => string): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return t('dashboard.profileTimeMinutes', { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('dashboard.profileTimeHours', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('dashboard.profileTimeDays', { count: days })
  return date.toLocaleDateString()
}
