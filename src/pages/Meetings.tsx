import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Calendar, Plus, Check, Trash2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useAdvisorMeetings } from '../hooks/useAdvisorMeetings'
import type { AdvisorMeeting } from '../db/schema'

export default function Meetings() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { upcoming, past, addMeeting, updateMeeting, deleteMeeting } = useAdvisorMeetings(profileId)

  const [showAdd, setShowAdd] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!activeProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Calendar className="w-12 h-12 text-[var(--accent-text)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-4">{t('research.meetings')}</h1>
        <p className="text-[var(--text-muted)]">{t('ai.createProfileFirst')}</p>
        <Link to="/exam-profile" className="btn-primary px-6 py-2.5 mt-4 inline-block">Create Profile</Link>
      </div>
    )
  }

  const handleAdd = () => {
    if (!newDate) return
    addMeeting(newDate, newNotes)
    setNewDate('')
    setNewNotes('')
    setShowAdd(false)
  }

  const handleComplete = (meeting: AdvisorMeeting) => {
    updateMeeting(meeting.id, { status: 'completed' })
  }

  const renderMeeting = (meeting: AdvisorMeeting) => {
    const isExpanded = expandedId === meeting.id
    const actionItems: string[] = JSON.parse(meeting.actionItems || '[]')

    return (
      <div key={meeting.id} className="glass-card p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <Calendar className="w-4 h-4 text-[var(--accent-text)]" />
            <span className="font-medium text-[var(--text-heading)]">{meeting.date}</span>
            {meeting.status === 'upcoming' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                {t('research.upcomingMeeting')}
              </span>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
          </button>
          <div className="flex items-center gap-1">
            {meeting.status === 'upcoming' && (
              <button
                onClick={() => handleComplete(meeting)}
                className="p-1.5 rounded hover:bg-[var(--bg-input)] text-green-500"
                title="Mark as completed"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => deleteMeeting(meeting.id)}
              className="p-1.5 rounded hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-3">
            {meeting.summary && (
              <div>
                <span className="text-xs font-medium text-[var(--text-muted)] uppercase">{t('research.meetingSummary')}</span>
                <p className="text-sm text-[var(--text-body)] mt-1">{meeting.summary}</p>
              </div>
            )}

            <div>
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase">{t('research.meetingNotes')}</span>
              <textarea
                value={meeting.notes}
                onChange={e => updateMeeting(meeting.id, { notes: e.target.value })}
                placeholder={t('research.meetingNotes')}
                className="w-full mt-1 p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] text-sm text-[var(--text-body)] min-h-[80px] resize-y"
              />
            </div>

            {actionItems.length > 0 && (
              <div>
                <span className="text-xs font-medium text-[var(--text-muted)] uppercase">{t('research.actionItems')}</span>
                <div className="mt-1 space-y-1">
                  {actionItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-[var(--text-body)]">
                      <span className="text-[var(--text-faint)]">-</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-chat-panel'))}
              className="inline-flex items-center gap-1 text-xs text-[var(--accent-text)] hover:underline"
            >
              <Sparkles className="w-3 h-3" /> {t('research.meetingPrep')}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('research.meetings')}</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> {t('research.addMeeting')}
        </button>
      </div>

      {showAdd && (
        <div className="glass-card p-4 mb-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">{t('research.meetingDate')}</label>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">{t('research.meetingNotes')}</label>
            <textarea
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="Agenda, topics to discuss..."
              className="input-field w-full min-h-[60px] resize-y"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary px-3 py-1 text-sm">{t('common.cancel')}</button>
            <button onClick={handleAdd} disabled={!newDate} className="btn-primary px-3 py-1 text-sm disabled:opacity-40">{t('common.create')}</button>
          </div>
        </div>
      )}

      {/* Upcoming meetings */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">{t('research.upcomingMeeting')}</h2>
          <div className="space-y-3">
            {upcoming.map(renderMeeting)}
          </div>
        </div>
      )}

      {/* Past meetings */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">{t('research.pastMeetings')}</h2>
          <div className="space-y-3">
            {past.map(renderMeeting)}
          </div>
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-muted)]">{t('research.noMeetings')}</p>
        </div>
      )}
    </div>
  )
}
