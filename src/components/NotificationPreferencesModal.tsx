import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { db } from '../db'
import type { NotificationPreferences } from '../db/schema'

interface Props {
  open: boolean
  onClose: () => void
  examProfileId: string
}

const defaults: Omit<NotificationPreferences, 'id' | 'examProfileId'> = {
  studyReminders: true,
  reviewDue: true,
  streakWarnings: true,
  planSuggestions: true,
  milestones: true,
}

export function NotificationPreferencesModal({ open, onClose, examProfileId }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)

  useEffect(() => {
    if (!open) return
    db.notificationPreferences.get(examProfileId).then(p => {
      setPrefs(p ?? { id: examProfileId, examProfileId, ...defaults })
    })
  }, [open, examProfileId])

  if (!open || !prefs) return null

  const toggle = async (key: keyof typeof defaults) => {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    await db.notificationPreferences.put(updated)
  }

  const toggles: Array<{ key: keyof typeof defaults; label: string; desc: string }> = [
    { key: 'studyReminders', label: 'Study Reminders', desc: 'Daily reminders to study' },
    { key: 'reviewDue', label: 'Review Due', desc: 'When flashcards need review' },
    { key: 'streakWarnings', label: 'Streak Warnings', desc: 'When your streak is at risk' },
    { key: 'planSuggestions', label: 'Plan Suggestions', desc: 'Study plan recommendations' },
    { key: 'milestones', label: 'Milestones', desc: 'Exam countdown milestones' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-heading)]">Notification Preferences</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-heading)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          {toggles.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-[var(--text-body)]">{label}</p>
                <p className="text-xs text-[var(--text-muted)]">{desc}</p>
              </div>
              <button
                onClick={() => toggle(key)}
                className={`w-10 h-6 rounded-full transition-colors ${
                  prefs[key] ? 'bg-[var(--accent-text)]' : 'bg-[var(--border-card)]'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                  prefs[key] ? 'translate-x-4' : ''
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
