/**
 * Full student model display with editing capabilities.
 * Shows learning style, common mistakes, preferred explanations, etc.
 */
import { useState } from 'react'
import { Brain, X, Sparkles } from 'lucide-react'
import { db } from '../../db'
import type { StudentModel } from '../../db/schema'

interface Props {
  studentModel: StudentModel | undefined
  profileId: string
}

function safeParse<T>(json: string | undefined | null, fallback: T): T {
  try { return JSON.parse(json || '') ?? fallback }
  catch { return fallback }
}

export function AIProfileCard({ studentModel, profileId }: Props) {
  const [removing, setRemoving] = useState<string | null>(null)

  if (!studentModel) {
    return (
      <div className="glass-card p-6 text-center">
        <Brain className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-1">Your AI Profile</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Complete a few study sessions to build your AI profile. The tutor learns your patterns over time.
        </p>
      </div>
    )
  }

  const learningStyle = safeParse(studentModel.learningStyle, {} as Record<string, unknown>)
  const commonMistakes: string[] = safeParse(studentModel.commonMistakes, [])
  const preferredExplanations: string[] = safeParse(studentModel.preferredExplanations, [])
  const motivationTriggers: string[] = safeParse(studentModel.motivationTriggers, [])
  const personalityNotes: string[] = safeParse(studentModel.personalityNotes, [])

  const hasData = commonMistakes.length > 0 || preferredExplanations.length > 0 ||
    Object.keys(learningStyle).length > 0 || motivationTriggers.length > 0 || personalityNotes.length > 0

  if (!hasData) {
    return (
      <div className="glass-card p-6 text-center">
        <Brain className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-1">Your AI Profile</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Chat with your AI tutor or complete exercises to start building your learning profile.
        </p>
      </div>
    )
  }

  const removeItem = async (field: string, value: string) => {
    setRemoving(`${field}-${value}`)
    try {
      const current: string[] = safeParse((studentModel as any)[field], [])
      // Remove by value match (first occurrence) to avoid stale-index race
      const idx = current.indexOf(value)
      if (idx === -1) return
      const updated = [...current.slice(0, idx), ...current.slice(idx + 1)]
      await db.studentModels.update(studentModel.id, { [field]: JSON.stringify(updated) })
    } finally {
      setRemoving(null)
    }
  }

  const updatedAt = studentModel.updatedAt
    ? new Date(studentModel.updatedAt).toLocaleDateString()
    : 'Unknown'

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-purple-500" />
        <h3 className="text-sm font-bold text-[var(--text-heading)]">Your AI Profile</h3>
        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
      </div>

      <div className="space-y-4">
        {/* Learning Style */}
        {Object.keys(learningStyle).length > 0 && (
          <Section title="Learning Style">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(learningStyle).map(([key, value]) => (
                <span key={key} className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 font-medium">
                  {String(value) === 'true' ? key : `${key}: ${value}`}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Common Mistakes */}
        {commonMistakes.length > 0 && (
          <Section title="Common Mistakes">
            <ul className="space-y-1">
              {commonMistakes.map((item, i) => (
                <li key={i} className="flex items-start gap-2 group">
                  <span className="text-xs text-[var(--text-body)] flex-1">- {item}</span>
                  <button
                    onClick={() => removeItem('commonMistakes', item)}
                    disabled={removing === `commonMistakes-${item}`}
                    className="p-0.5 rounded text-[var(--text-faint)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Preferred Explanations */}
        {preferredExplanations.length > 0 && (
          <Section title="What Works For You">
            <ul className="space-y-1">
              {preferredExplanations.map((item, i) => (
                <li key={i} className="flex items-start gap-2 group">
                  <span className="text-xs text-[var(--text-body)] flex-1">- {item}</span>
                  <button
                    onClick={() => removeItem('preferredExplanations', item)}
                    disabled={removing === `preferredExplanations-${item}`}
                    className="p-0.5 rounded text-[var(--text-faint)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Motivation Triggers */}
        {motivationTriggers.length > 0 && (
          <Section title="Motivation Triggers">
            <ul className="space-y-1">
              {motivationTriggers.map((item, i) => (
                <li key={i} className="flex items-start gap-2 group">
                  <span className="text-xs text-[var(--text-body)] flex-1">- {item}</span>
                  <button
                    onClick={() => removeItem('motivationTriggers', item)}
                    disabled={removing === `motivationTriggers-${item}`}
                    className="p-0.5 rounded text-[var(--text-faint)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Personality Notes */}
        {personalityNotes.length > 0 && (
          <Section title="Personality Notes">
            <ul className="space-y-1">
              {personalityNotes.map((item, i) => (
                <li key={i} className="text-xs text-[var(--text-muted)]">- {item}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <p className="text-[10px] text-[var(--text-faint)] mt-4 pt-3 border-t border-[var(--border-card)]">
        Last updated: {updatedAt} — The AI tutor adapts to these observations automatically.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{title}</span>
      <div className="mt-1">{children}</div>
    </div>
  )
}
