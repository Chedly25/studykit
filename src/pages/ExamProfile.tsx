import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Check } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { ExamProfileWizard } from '../components/knowledge/ExamProfileWizard'
import { examBlueprints } from '../lib/examTopicMaps'

export default function ExamProfile() {
  const { t } = useTranslation()
  const { profiles, activeProfile, setActiveProfile, deleteProfile } = useExamProfile()
  const [showWizard, setShowWizard] = useState(profiles.length === 0)

  if (showWizard || profiles.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-6">{t('profile.create')}</h1>
        <ExamProfileWizard />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('profile.studyProfile')}</h1>
        <button onClick={() => setShowWizard(true)} className="btn-primary px-4 py-2 text-sm">
          {t('profile.create')}
        </button>
      </div>

      <div className="space-y-3">
        {profiles.map(p => {
          const bp = examBlueprints[p.examType]
          const isActive = p.id === activeProfile?.id
          const daysLeft = Math.max(0, Math.ceil((new Date(p.examDate).getTime() - Date.now()) / 86400000))

          return (
            <div key={p.id} className={`glass-card p-4 transition-all ${isActive ? 'border-[var(--accent-text)] ring-1 ring-[var(--accent-text)]/20' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--text-heading)]">{p.name}</h3>
                    {isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent-text)]">{t('profile.activeProfile')}</span>
                    )}
                  </div>
                  <div className="text-sm text-[var(--text-muted)] mt-1">
                    {bp?.label ?? t(`goalTypes.${p.examType}`)} &middot; {t('dashboard.daysLeft', { count: daysLeft })} &middot; {t('dashboard.hoursTarget', { hours: p.weeklyTargetHours })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      onClick={() => setActiveProfile(p.id)}
                      className="p-2 rounded-lg hover:bg-[var(--accent-bg)] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
                      title={t('profile.switchProfile')}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(t('profile.deleteConfirm'))) {
                        deleteProfile(p.id)
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    title={t('profile.deleteProfile')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
