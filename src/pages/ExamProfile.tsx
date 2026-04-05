import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2, Link2, FileBarChart, ArrowRight, Pencil, X, Check, Calendar, Clock, Target } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { hasSavedWizardDraft, clearWizardDraft } from '../hooks/useWizardDraft'
import { ProjectBriefingWizard } from '../components/wizard/ProjectBriefingWizard'
import { DependencyEditor } from '../components/knowledge/DependencyEditor'
import { QuickStartModal } from '../components/QuickStartModal'
import { ExamFormatEditor } from '../components/knowledge/ExamFormatEditor'
import { examBlueprints } from '../lib/examTopicMaps'
import { db } from '../db'
import type { ExamProfile as ExamProfileType, Topic } from '../db/schema'

interface EditState {
  name: string
  examDate: string
  weeklyTargetHours: number
  passingThreshold: number
}

function ProfileCard({
  profile,
  isActive,
  hasPlan,
  onActivate,
  onUpdate,
  onDelete,
}: {
  profile: ExamProfileType
  isActive: boolean
  hasPlan: boolean
  onActivate: () => void
  onUpdate: (updates: Partial<EditState>) => Promise<void>
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editState, setEditState] = useState<EditState>({
    name: profile.name,
    examDate: profile.examDate,
    weeklyTargetHours: profile.weeklyTargetHours,
    passingThreshold: profile.passingThreshold,
  })

  const bp = examBlueprints[profile.examType]
  const daysLeft = profile.examDate
    ? Math.max(0, Math.ceil((new Date(profile.examDate).getTime() - Date.now()) / 86400000))
    : 0

  const handleSave = async () => {
    await onUpdate(editState)
    setEditing(false)
  }

  const handleCancel = () => {
    setEditState({
      name: profile.name,
      examDate: profile.examDate,
      weeklyTargetHours: profile.weeklyTargetHours,
      passingThreshold: profile.passingThreshold,
    })
    setEditing(false)
  }

  const handleDelete = () => {
    if (deleteConfirm) {
      onDelete()
      setDeleteConfirm(false)
    } else {
      setDeleteConfirm(true)
      setTimeout(() => setDeleteConfirm(false), 4000)
    }
  }

  if (editing) {
    return (
      <div className={`glass-card p-5 transition-all ${isActive ? 'border-[var(--accent-text)] ring-1 ring-[var(--accent-text)]/20' : ''}`}>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{t('profile.profileName')}</label>
            <input
              type="text"
              value={editState.name}
              onChange={e => setEditState(s => ({ ...s, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-body)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />{t('profile.targetDate')}
              </label>
              <input
                type="date"
                value={editState.examDate}
                onChange={e => setEditState(s => ({ ...s, examDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-body)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
              />
            </div>

            {/* Weekly hours */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                <Clock className="w-3 h-3 inline mr-1" />{t('profile.weeklyHours')}
              </label>
              <input
                type="number"
                min={1}
                max={80}
                value={editState.weeklyTargetHours}
                onChange={e => setEditState(s => ({ ...s, weeklyTargetHours: Math.max(1, Number(e.target.value)) }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-body)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
              />
            </div>

            {/* Target score */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                <Target className="w-3 h-3 inline mr-1" />{t('profile.targetScore')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editState.passingThreshold}
                  onChange={e => setEditState(s => ({ ...s, passingThreshold: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-body)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
                />
                <span className="text-sm text-[var(--text-muted)]">%</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!editState.name.trim()}
              className="btn-primary px-4 py-1.5 text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> {t('common.save')}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`glass-card p-4 transition-all ${isActive ? 'border-[var(--accent-text)] ring-1 ring-[var(--accent-text)]/20' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--text-heading)] truncate">{profile.name}</h3>
            {isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent-text)] shrink-0">{t('profile.activeProfile')}</span>
            )}
          </div>
          <div className="text-sm text-[var(--text-muted)] mt-1 flex flex-wrap gap-x-2">
            <span>{bp?.label ?? t(`goalTypes.${profile.examType}`)}</span>
            {profile.examDate && <span>&middot; {t('dashboard.daysLeft', { count: daysLeft })}</span>}
            {profile.profileMode === 'research' && <span>&middot; {t('research.modeResearch')}</span>}
            <span>&middot; {t('dashboard.hoursTarget', { hours: profile.weeklyTargetHours })}</span>
            <span>&middot; {t('profile.targetScore')}: {profile.passingThreshold}%</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          {isActive ? (
            <>
              {hasPlan && (
                <Link
                  to="/study-plan"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" /> {t('ai.studyPlan')}
                </Link>
              )}
              <Link
                to="/dashboard"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:bg-[var(--accent-text)] hover:text-white transition-colors"
              >
                {t('nav.dashboard')} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          ) : (
            <button
              onClick={onActivate}
              className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors"
            >
              {t('profile.switchProfile')}
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            className="p-2 rounded-lg hover:bg-[var(--accent-bg)] text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
            title={t('profile.editProfile')}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className={`p-2 rounded-lg transition-colors ${
              deleteConfirm
                ? 'bg-red-500/10 text-red-500'
                : 'hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500'
            }`}
            title={deleteConfirm ? t('profile.deleteConfirm') : t('profile.deleteProfile')}
          >
            {deleteConfirm ? <X className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {deleteConfirm && (
        <div className="mt-2 p-2 rounded-lg bg-red-500/10 text-xs text-red-600 flex items-center justify-between">
          <span>{t('profile.deleteConfirm')}</span>
          <div className="flex gap-2">
            <button onClick={handleDelete} className="font-medium hover:underline">{t('common.yes')}</button>
            <button onClick={() => setDeleteConfirm(false)} className="text-[var(--text-muted)] hover:underline">{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExamProfile() {
  const { t } = useTranslation()
  const { profiles, activeProfile, setActiveProfile, updateProfile, deleteProfile, profilesLoaded } = useExamProfile()
  const { topics } = useKnowledgeGraph(activeProfile?.id)
  const [showWizard, setShowWizard] = useState(() => hasSavedWizardDraft())
  const [showDependencyEditor, setShowDependencyEditor] = useState(false)
  const [dependencyTopic, setDependencyTopic] = useState<Topic | null>(null)
  const [showExamFormatEditor, setShowExamFormatEditor] = useState(false)
  const [showQuickStart, setShowQuickStart] = useState(false)

  // Query which profiles have active study plans
  const plansMap = useLiveQuery(async () => {
    const plans = await db.studyPlans.filter(p => p.isActive).toArray()
    const map: Record<string, boolean> = {}
    for (const p of plans) map[p.examProfileId] = true
    return map
  }, [])

  // Auto-show wizard when there are no profiles (first-time user).
  // Once showWizard is latched true, it stays true until user cancels — this prevents
  // the wizard from unmounting when createProfile() in Step 1 adds a profile to the DB.
  useEffect(() => {
    if (profilesLoaded && profiles.length === 0) {
      setShowWizard(true)
    }
  }, [profilesLoaded, profiles.length])

  if (showWizard) {
    return (
      <div className="mx-auto px-4 py-8 animate-fade-in">
        <div className="max-w-4xl mx-auto flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('profile.create')}</h1>
          {profiles.length > 0 && (
            <button onClick={() => { setShowWizard(false); clearWizardDraft() }} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors">
              {t('common.back')}
            </button>
          )}
        </div>
        <ProjectBriefingWizard />
      </div>
    )
  }

  if (!profilesLoaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('nav.projects')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('profile.projectsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQuickStart(true)} className="btn-secondary px-4 py-2 text-sm">
            Quick Start
          </button>
          <button onClick={() => setShowWizard(true)} className="btn-primary px-4 py-2 text-sm">
            {t('profile.create')}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {profiles.map(p => (
          <ProfileCard
            key={p.id}
            profile={p}
            isActive={p.id === activeProfile?.id}
            hasPlan={!!plansMap?.[p.id]}
            onActivate={() => setActiveProfile(p.id)}
            onUpdate={async (updates) => updateProfile(p.id, updates)}
            onDelete={() => deleteProfile(p.id)}
          />
        ))}
      </div>

      {/* Profile tools for active profile */}
      {activeProfile && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-3">{t('profile.editProfile')}</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setShowExamFormatEditor(true)}
              className="btn-secondary px-4 py-2 text-sm flex items-center gap-2"
            >
              <FileBarChart className="w-4 h-4" /> {t('examFormat.editFormat')}
            </button>
          </div>
          {topics.length > 0 && (
            <div className="mt-4">
              <label className="block text-xs text-[var(--text-muted)] mb-2">{t('dependencies.editPrerequisites')}</label>
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

      {/* Quick Start Modal */}
      <QuickStartModal open={showQuickStart} onClose={() => setShowQuickStart(false)} />
    </div>
  )
}
