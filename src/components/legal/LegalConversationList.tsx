import { useState } from 'react'
import { Plus, MessageSquare, Trash2, Check, X, Pencil } from 'lucide-react'
import type { Conversation } from '../../db/schema'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}

export function LegalConversationList({ conversations, activeId, onSelect, onNew, onDelete, onRename }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const startEdit = (c: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(c.id)
    setEditTitle(c.title)
  }

  const commitEdit = (id: string, e?: React.FormEvent) => {
    e?.preventDefault()
    if (editTitle.trim()) onRename(id, editTitle.trim())
    setEditingId(null)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    if (sameDay) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    const dayMs = 86400000
    const diff = (now.getTime() - d.getTime()) / dayMs
    if (diff < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[var(--border-card)]">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nouvelle recherche
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <div className="text-center py-8 px-4 text-xs text-[var(--text-muted)]">
            Aucune recherche récente
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((c) => {
              const isActive = c.id === activeId
              const isEditing = c.id === editingId
              return (
                <div
                  key={c.id}
                  className={`group relative rounded-lg transition-colors ${
                    isActive ? 'bg-[var(--accent-bg)]' : 'hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {isEditing ? (
                    <form onSubmit={(e) => commitEdit(c.id, e)} className="flex items-center gap-1 p-2">
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => commitEdit(c.id)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null) }}
                        className="flex-1 bg-transparent text-sm px-1 py-0.5 border border-[var(--border-card)] rounded focus:outline-none focus:border-[var(--accent-text)]"
                      />
                      <button type="submit" className="p-1 text-[var(--color-success)]">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="p-1 text-[var(--text-muted)]">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => onSelect(c.id)}
                      className="w-full text-left px-3 py-2 flex items-start gap-2"
                    >
                      <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm truncate ${isActive ? 'font-medium text-[var(--accent-text)]' : 'text-[var(--text-secondary)]'}`}>
                          {c.title || 'Sans titre'}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">
                          {formatDate(c.updatedAt)}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => startEdit(c, e)}
                          className="p-1 rounded hover:bg-[var(--bg-card)] text-[var(--text-muted)]"
                          title="Renommer"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Supprimer cette recherche ?')) onDelete(c.id)
                          }}
                          className="p-1 rounded hover:bg-[var(--color-error-bg)] text-[var(--text-muted)] hover:text-[var(--color-error)]"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
