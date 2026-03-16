import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Trash2, Check, Link2, FileBarChart, ArrowRight } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { ExamProfileWizard } from '../components/knowledge/ExamProfileWizard'
import { DependencyEditor } from '../components/knowledge/DependencyEditor'
import { ExamFormatEditor } from '../components/knowledge/ExamFormatEditor'
import { examBlueprints } from '../lib/examTopicMaps'
import type { Topic } from '../db/schema'

export default function ExamProfile() {
  const { t } = useTranslation()
  const { profiles, activeProfile, setActiveProfile, deleteProfile } = useExamProfile()
  const { topics } = useKnowledgeGraph(activeProfile?.id)
  const [showWizard, setShowWizard] = useState(profiles.length === 0)
  const [showDependencyEditor, setShowDependencyEditor] = useState(false)
  const [dependencyTopic, setDependencyTopic] = useState<Topic | null>(null)
  const [showExamFormatEditor, setShowExamFormatEditor] = useState(false)

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
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('nav.projects', 'Projects')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('profile.projectsSubtitle', 'Switch between profiles or create a new one')}</p>
        </div>
        <button onClick={() => setShowWizard(true)} className="btn-primary px-4 py-2 text-sm">
          {t('profile.create')}
        </button>
      </div>

      <div className="space-y-3">
        {profiles.map(p => {
          const bp = examBlueprints[p.examType]
          const isActive = p.id === activeProfile?.id
          const daysLeft = p.examDate ? Math.max(0, Math.ceil((new Date(p.examDate).getTime() - Date.now()) / 86400000)) : 0

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
                    {bp?.label ?? t(`goalTypes.${p.examType}`)}
                    {p.examDate ? ` · ${t('dashboard.daysLeft', { count: daysLeft })}` : ''}
                    {p.profileMode === 'research' ? ` · ${t('research.modeResearch')}` : ''}
                    {' · '}{t('dashboard.hoursTarget', { hours: p.weeklyTargetHours })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isActive ? (
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:bg-[var(--accent-text)] hover:text-white transition-colors"
                    >
                      {t('nav.dashboard')} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <button
                      onClick={() => setActiveProfile(p.id)}
                      className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors"
                      title={t('profile.switchProfile')}
                    >
                      {t('profile.switchProfile')}
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

      {/* Profile tools for active profile */}
      {activeProfile && (
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowExamFormatEditor(true)}
            className="btn-secondary px-4 py-2 text-sm flex items-center gap-2"
          >
            <FileBarChart className="w-4 h-4" /> {t('examFormat.editFormat')}
          </button>
          {topics.length > 0 && (
            <div className="flex-1">
              <label className="block text-xs text-[var(--text-muted)] mb-1">{t('dependencies.editPrerequisites')}</label>
              <div className="flex flex-wrap gap-1">
                {topics.slice(0, 12).map(topic => (
                  <button
                    key={topic.id}
                    onClick={() => { setDependencyTopic(topic); setShowDependencyEditor(true) }}
                    className="text-xs px-2 py-1 rounded-lg bg-[var(--bg-input)] text-[var(--text-body)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" /> {topic.name}
                  </button>
                ))}
                {topics.length > 12 && (
                  <span className="text-xs text-[var(--text-muted)] px-2 py-1">+{topics.length - 12} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeProfile && (
        <>
          <DependencyEditor
            open={showDependencyEditor}
            onClose={() => { setShowDependencyEditor(false); setDependencyTopic(null) }}
            topic={dependencyTopic}
            examProfileId={activeProfile.id}
          />
          <ExamFormatEditor
            open={showExamFormatEditor}
            onClose={() => setShowExamFormatEditor(false)}
            examProfileId={activeProfile.id}
          />
        </>
      )}
    </div>
  )
}
