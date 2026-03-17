/**
 * Article Review page — phase-based rendering for the full review lifecycle.
 */
import { useEffect } from 'react'
import { FileSearch, Plus, Trash2, ArrowLeft, Loader2, Calendar, Target } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useReviewProject } from '../hooks/useReviewProject'
import { ReviewProjectSetup } from '../components/review/ReviewProjectSetup'
import { ReviewArticleUploader } from '../components/review/ReviewArticleUploader'
import { ReviewBatchProgress } from '../components/review/ReviewBatchProgress'
import { ReviewDashboard } from '../components/review/ReviewDashboard'
import type { ReviewProject } from '../db/schema'

export default function ArticleReview() {
  const { activeProfile } = useExamProfile()
  const rp = useReviewProject(activeProfile?.id)

  // Scroll to top on phase change
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [rp.phase])

  if (!activeProfile) {
    return (
      <div className="text-center py-24 animate-fade-in">
        <FileSearch size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
        <h2 className="text-xl font-bold text-[var(--text-heading)] mb-2">Article Review</h2>
        <p className="text-[var(--text-muted)]">Select a project profile to get started.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {rp.phase !== 'list' && (
            <button onClick={rp.goToList} className="btn-action p-2 rounded-lg hover:bg-[var(--bg-input)]">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl font-bold text-[var(--text-heading)] flex items-center gap-2">
              <FileSearch size={28} className="text-[var(--accent-text)]" />
              Article Review
            </h1>
            {rp.activeProject && rp.phase !== 'list' && (
              <p className="text-sm text-[var(--text-muted)] mt-0.5">{rp.activeProject.name}</p>
            )}
          </div>
        </div>

        {rp.phase === 'list' && (
          <button
            onClick={() => rp.setPhase('setup')}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Plus size={14} /> New Project
          </button>
        )}
      </div>

      {/* Phase: List */}
      {rp.phase === 'list' && (
        <ProjectList
          projects={rp.projects}
          onSelect={rp.selectProject}
          onDelete={rp.deleteProject}
        />
      )}

      {/* Phase: Setup */}
      {rp.phase === 'setup' && !rp.activeProject && (
        <ReviewProjectSetup
          onSubmit={async (name, desc, deadline, count) => {
            await rp.createProject(name, desc, deadline, count)
          }}
          onBack={rp.goToList}
        />
      )}

      {rp.phase === 'setup' && rp.activeProject && (
        <div className="space-y-4">
          <div className="glass-card p-4">
            <h3 className="font-semibold text-[var(--text-heading)] mb-1">{rp.activeProject.name}</h3>
            <p className="text-sm text-[var(--text-muted)]">{rp.activeProject.description}</p>
            {rp.activeProject.deadline && (
              <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
                <Calendar size={12} /> Deadline: {rp.activeProject.deadline}
              </p>
            )}
          </div>
          <ReviewArticleUploader
            onUpload={async (files) => {
              return rp.uploadArticles(files)
            }}
            onStartProcessing={(items) => rp.startProcessing(items)}
            articleCount={rp.articles.length}
          />
        </div>
      )}

      {/* Phase: Processing */}
      {(rp.phase === 'processing' || rp.phase === 'uploading') && (
        <ReviewBatchProgress
          progress={rp.batchProgress}
          onCancel={rp.cancelProcessing}
          isRunning={rp.isBatchRunning}
        />
      )}

      {/* Phase: Synthesizing */}
      {rp.phase === 'synthesizing' && (
        <div className="glass-card p-8 text-center animate-fade-in">
          <Loader2 size={32} className="mx-auto mb-4 text-[var(--accent-text)] animate-spin" />
          <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
            Synthesizing Results
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
            Clustering themes and ranking articles across your corpus...
          </p>
        </div>
      )}

      {/* Phase: Reviewing */}
      {rp.phase === 'reviewing' && rp.activeProject && (
        <ReviewDashboard project={rp.activeProject} />
      )}

      {/* Error display */}
      {(rp.batchError || rp.synthesisError) && (
        <div className="glass-card p-4 mt-4 border-red-500/20 bg-red-500/5">
          <p className="text-sm text-red-400">
            {rp.batchError || rp.synthesisError}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Project List Sub-component ─────────────────────────────────

function ProjectList({
  projects,
  onSelect,
  onDelete,
}: {
  projects: ReviewProject[]
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <FileSearch size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
        <h3 className="text-lg font-semibold text-[var(--text-heading)] mb-2">
          No review projects yet
        </h3>
        <p className="text-sm text-[var(--text-muted)]">
          Create a new project to start reviewing academic articles with AI.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
      {projects.map(project => (
        <div
          key={project.id}
          className="glass-card glass-card-hover p-5 cursor-pointer"
          onClick={() => onSelect(project.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[var(--text-heading)] mb-1 truncate">{project.name}</h3>
              <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-3">{project.description}</p>
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <span className={`px-2 py-0.5 rounded-full ${
                  project.status === 'reviewing' ? 'bg-green-500/10 text-green-500' :
                  project.status === 'processing' ? 'bg-amber-500/10 text-amber-500' :
                  project.status === 'completed' ? 'bg-blue-500/10 text-blue-500' :
                  'bg-[var(--bg-input)] text-[var(--text-muted)]'
                }`}>
                  {project.status}
                </span>
                {project.deadline && (
                  <span className="flex items-center gap-1">
                    <Calendar size={10} /> {project.deadline}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Target size={10} /> {project.targetShortlistCount} target
                </span>
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(project.id) }}
              className="btn-action p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400"
              title="Delete project"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
