import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ListChecks, ChevronDown } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('assignment-tracker')!

const STORAGE_KEY = 'studieskit-assignments'

type Priority = 'low' | 'medium' | 'high'
type Status = 'todo' | 'in-progress' | 'done'
type SortBy = 'dueDate' | 'priority' | 'status'
type FilterTab = 'all' | Status

interface Assignment {
  id: string
  title: string
  description: string
  dueDate: string
  priority: Priority
  status: Status
  createdAt: string
}

function loadAssignments(): Assignment[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* ignore */ }
  return []
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
const STATUS_ORDER: Record<Status, number> = { todo: 0, 'in-progress': 1, done: 2 }

function isOverdue(dueDate: string, status: Status): boolean {
  if (status === 'done') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dueDate + 'T00:00:00') < today
}

export default function AssignmentTracker() {
  const [assignments, setAssignments] = useState<Assignment[]>(loadAssignments)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [sortBy, setSortBy] = useState<SortBy>('dueDate')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments))
  }, [assignments])

  const addAssignment = useCallback(() => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle || !dueDate) return
    const newAssignment: Assignment = {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      description: description.trim(),
      dueDate,
      priority,
      status: 'todo',
      createdAt: new Date().toISOString(),
    }
    setAssignments(prev => [...prev, newAssignment])
    setTitle('')
    setDescription('')
    setDueDate('')
    setPriority('medium')
  }, [title, description, dueDate, priority])

  const deleteAssignment = useCallback((id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id))
  }, [])

  const updateStatus = useCallback((id: string, newStatus: Status) => {
    setAssignments(prev =>
      prev.map(a => (a.id === id ? { ...a, status: newStatus } : a))
    )
  }, [])

  const filtered = filterTab === 'all'
    ? assignments
    : assignments.filter(a => a.status === filterTab)

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'dueDate':
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      case 'priority':
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      case 'status':
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      default:
        return 0
    }
  })

  const priorityClasses: Record<Priority, string> = {
    low: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    medium: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
    high: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  }

  const statusClasses: Record<Status, string> = {
    todo: 'bg-[var(--accent-bg)] text-[var(--text-muted)]',
    'in-progress': 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
    done: 'bg-[var(--accent-bg)] text-[var(--accent-text)]',
  }

  const statusLabels: Record<Status, string> = {
    todo: 'To Do',
    'in-progress': 'In Progress',
    done: 'Done',
  }

  const filterTabs: { value: FilterTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'todo', label: 'To Do' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'done', label: 'Done' },
  ]

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        {/* Add form */}
        <div className="glass-card p-4 mb-6 space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-heading)]">
            Add Assignment
          </h2>
          <input
            type="text"
            placeholder="Assignment title..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="input-field w-full"
          />
          <textarea
            placeholder="Description (optional)..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="input-field w-full resize-none"
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div className="flex-1">
              <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-1">
                Priority
              </label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as Priority[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all border ${
                      priority === p
                        ? `${priorityClasses[p]} border-current`
                        : 'border-[var(--border-card)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={addAssignment}
            disabled={!title.trim() || !dueDate}
            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            Add Assignment
          </button>
        </div>

        {/* Controls: sort + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center justify-between">
          <div className="flex gap-1 bg-[var(--bg-input)] p-1 rounded-lg">
            {filterTabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilterTab(tab.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  filterTab === tab.value
                    ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider mr-2">Sort by</label>
            <div className="relative inline-block">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortBy)}
                className="select-field appearance-none pr-8"
              >
                <option value="dueDate">Due Date</option>
                <option value="priority">Priority</option>
                <option value="status">Status</option>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Assignment list */}
        {sorted.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <ListChecks size={40} className="text-[var(--text-faint)] mx-auto mb-3" />
            <p className="text-[var(--text-muted)]">
              {assignments.length === 0
                ? 'No assignments yet. Add your first one above.'
                : 'No assignments match this filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(assignment => {
              const overdue = isOverdue(assignment.dueDate, assignment.status)
              return (
                <div
                  key={assignment.id}
                  className={`glass-card p-4 transition-all ${
                    overdue ? 'border border-[var(--color-error-border)]' : ''
                  } ${assignment.status === 'done' ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-heading)] truncate">
                          {assignment.title}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityClasses[assignment.priority]}`}>
                          {assignment.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses[assignment.status]}`}>
                          {statusLabels[assignment.status]}
                        </span>
                        {overdue && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-error-bg)] text-[var(--color-error)]">
                            Overdue
                          </span>
                        )}
                      </div>
                      {assignment.description && (
                        <p className="text-[var(--text-muted)] text-sm mb-1">{assignment.description}</p>
                      )}
                      <p className="text-[var(--text-faint)] text-xs">
                        Due: {new Date(assignment.dueDate + 'T00:00:00').toLocaleDateString(undefined, {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative">
                        <select
                          value={assignment.status}
                          onChange={e => updateStatus(assignment.id, e.target.value as Status)}
                          className="select-field text-xs appearance-none pr-7 py-1.5"
                        >
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                      </div>
                      <button
                        onClick={() => deleteAssignment(assignment.id)}
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--color-error)] transition-colors"
                        aria-label={`Delete ${assignment.title}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </FormToolPage>
    </>
  )
}
