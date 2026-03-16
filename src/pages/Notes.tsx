import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Trash2, Link2, StickyNote, ArrowLeft } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { useResearchNotes } from '../hooks/useResearchNotes'
import type { ResearchNote } from '../db/schema'

export default function Notes() {
  const { t } = useTranslation()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { notes, createNote, updateNote, deleteNote, getBacklinks } = useResearchNotes(profileId)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const selectedNote = notes.find(n => n.id === selectedId)
  const backlinks = selectedNote ? getBacklinks(selectedNote.id) : []

  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes
    const q = searchQuery.toLowerCase()
    return notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.toLowerCase().includes(q)
    )
  }, [notes, searchQuery])

  const handleCreate = async () => {
    const id = await createNote(t('research.noteTitle'))
    if (id) setSelectedId(id)
  }

  const handleDelete = async (id: string) => {
    await deleteNote(id)
    if (selectedId === id) setSelectedId(null)
  }

  const parseTags = (note: ResearchNote): string[] => {
    try { return JSON.parse(note.tags || '[]') } catch { return [] }
  }

  const parseLinkedNotes = (note: ResearchNote): string[] => {
    try { return JSON.parse(note.linkedNoteIds || '[]') } catch { return [] }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">{t('research.notes')}</h1>
        <button onClick={handleCreate} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> {t('research.addNote')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_240px] gap-4">
        {/* Left: Note list */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('common.search')}
              className="input-field w-full pl-9 text-sm"
            />
          </div>

          <div className="space-y-1 max-h-[70vh] overflow-y-auto">
            {filteredNotes.map(note => {
              const tags = parseTags(note)
              return (
                <button
                  key={note.id}
                  onClick={() => setSelectedId(note.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedId === note.id
                      ? 'bg-[var(--accent-bg)] ring-1 ring-[var(--accent-text)]/30'
                      : 'hover:bg-[var(--bg-input)]'
                  }`}
                >
                  <div className="font-medium text-sm text-[var(--text-heading)] truncate">{note.title}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                    {note.content.slice(0, 80) || 'Empty note'}
                  </div>
                  {tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-faint)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}

            {filteredNotes.length === 0 && (
              <div className="text-center py-8">
                <StickyNote className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-muted)]">{t('research.noNotes')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Center: Editor */}
        {selectedNote ? (
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedId(null)}
                className="lg:hidden p-1 text-[var(--text-muted)] hover:text-[var(--text-heading)]"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`text-xs px-2 py-1 rounded ${showPreview ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`}
                >
                  Preview
                </button>
                <button
                  onClick={() => handleDelete(selectedNote.id)}
                  className="p-1 text-[var(--text-muted)] hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <input
              type="text"
              value={selectedNote.title}
              onChange={e => updateNote(selectedNote.id, { title: e.target.value })}
              className="w-full text-xl font-bold text-[var(--text-heading)] bg-transparent border-none outline-none"
              placeholder={t('research.noteTitle')}
            />

            {/* Tags editor */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">{t('research.tags')}:</span>
              <input
                type="text"
                value={parseTags(selectedNote).join(', ')}
                onChange={e => {
                  const tags = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  updateNote(selectedNote.id, { tags: JSON.stringify(tags) })
                }}
                placeholder="tag1, tag2..."
                className="flex-1 text-xs bg-transparent border-none outline-none text-[var(--text-body)]"
              />
            </div>

            {showPreview ? (
              <div className="prose prose-sm max-w-none text-[var(--text-body)] min-h-[40vh] whitespace-pre-wrap">
                {selectedNote.content || 'Nothing to preview...'}
              </div>
            ) : (
              <textarea
                value={selectedNote.content}
                onChange={e => updateNote(selectedNote.id, { content: e.target.value })}
                placeholder="Start writing..."
                className="w-full min-h-[50vh] p-0 bg-transparent border-none outline-none text-sm text-[var(--text-body)] leading-relaxed resize-none font-mono"
              />
            )}
          </div>
        ) : (
          <div className="glass-card p-8 flex flex-col items-center justify-center text-center min-h-[50vh]">
            <StickyNote className="w-12 h-12 text-[var(--text-muted)] mb-3" />
            <p className="text-[var(--text-muted)]">Select a note or create a new one</p>
          </div>
        )}

        {/* Right sidebar: Links */}
        {selectedNote && (
          <div className="space-y-4">
            {/* Linked notes */}
            <div className="glass-card p-3">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                <Link2 className="w-3 h-3 inline mr-1" />
                {t('research.linkedNotes')}
              </h4>
              {parseLinkedNotes(selectedNote).length > 0 ? (
                <div className="space-y-1">
                  {parseLinkedNotes(selectedNote).map(linkedId => {
                    const linked = notes.find(n => n.id === linkedId)
                    if (!linked) return null
                    return (
                      <button
                        key={linkedId}
                        onClick={() => setSelectedId(linkedId)}
                        className="w-full text-left text-sm text-[var(--accent-text)] hover:underline truncate"
                      >
                        {linked.title}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-faint)]">No linked notes</p>
              )}
            </div>

            {/* Backlinks */}
            <div className="glass-card p-3">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                {t('research.backlinks')}
              </h4>
              {backlinks.length > 0 ? (
                <div className="space-y-1">
                  {backlinks.map(bl => (
                    <button
                      key={bl.id}
                      onClick={() => setSelectedId(bl.id)}
                      className="w-full text-left text-sm text-[var(--accent-text)] hover:underline truncate"
                    >
                      {bl.title}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-faint)]">No backlinks</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
