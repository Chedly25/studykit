/**
 * Form for creating/editing a review project — name, criteria, deadline, target count.
 */
import { useState } from 'react'
import { FileText, Calendar, Target, ArrowLeft } from 'lucide-react'

interface Props {
  onSubmit: (name: string, description: string, deadline: string, targetCount: number) => void
  onBack: () => void
}

export function ReviewProjectSetup({ onSubmit, onBack }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [targetCount, setTargetCount] = useState(10)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !description.trim()) return
    onSubmit(name.trim(), description.trim(), deadline, targetCount)
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 max-w-2xl mx-auto animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors mb-4"
      >
        <ArrowLeft size={14} /> Back to projects
      </button>

      <h2 className="text-xl font-bold text-[var(--text-heading)] mb-6 flex items-center gap-2">
        <FileText size={20} className="text-[var(--accent-text)]" />
        New Review Project
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-body)] mb-1">Project Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., AI in Legal Research — Literature Review"
            className="input-field w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
            Review Criteria / Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe what you're looking for: research themes, methodology preferences, relevance criteria..."
            className="input-field w-full h-32 resize-none"
            required
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            The AI will evaluate each article against these criteria
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1 flex items-center gap-1">
              <Calendar size={14} /> Deadline
            </label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1 flex items-center gap-1">
              <Target size={14} /> Target Shortlist
            </label>
            <input
              type="number"
              value={targetCount}
              onChange={e => setTargetCount(Number(e.target.value))}
              min={1}
              max={100}
              className="input-field w-full"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={!name.trim() || !description.trim()}
        className="btn-primary w-full mt-6 py-2.5"
      >
        Create Project
      </button>
    </form>
  )
}
