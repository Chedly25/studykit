import { useState, useEffect, useCallback } from 'react'
import { Save, Trash2, Plus, Copy, Check } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('cornell-notes')!

const STORAGE_KEY = 'studykit-cornell-notes'

interface NoteSet {
  id: string
  title: string
  cues: string
  notes: string
  summary: string
  updatedAt: string
}

function generateId(): string {
  return crypto.randomUUID()
}

function loadNotes(): NoteSet[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as NoteSet[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // ignore
  }
  return []
}

function saveNotes(notes: NoteSet[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
}

export default function CornellNotes() {
  const [savedNotes, setSavedNotes] = useState<NoteSet[]>(loadNotes)
  const [title, setTitle] = useState('')
  const [cues, setCues] = useState('')
  const [notes, setNotes] = useState('')
  const [summary, setSummary] = useState('')
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    saveNotes(savedNotes)
  }, [savedNotes])

  const clearFields = useCallback(() => {
    setTitle('')
    setCues('')
    setNotes('')
    setSummary('')
    setActiveNoteId(null)
  }, [])

  const handleSave = useCallback(() => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const now = new Date().toISOString()

    if (activeNoteId) {
      // Update existing
      setSavedNotes(prev =>
        prev.map(n =>
          n.id === activeNoteId
            ? { ...n, title: trimmedTitle, cues, notes, summary, updatedAt: now }
            : n
        )
      )
    } else {
      // Create new
      const newNote: NoteSet = {
        id: generateId(),
        title: trimmedTitle,
        cues,
        notes,
        summary,
        updatedAt: now,
      }
      setSavedNotes(prev => [...prev, newNote])
      setActiveNoteId(newNote.id)
    }
  }, [title, cues, notes, summary, activeNoteId])

  const loadNote = useCallback((noteId: string) => {
    const note = savedNotes.find(n => n.id === noteId)
    if (!note) return
    setTitle(note.title)
    setCues(note.cues)
    setNotes(note.notes)
    setSummary(note.summary)
    setActiveNoteId(note.id)
  }, [savedNotes])

  const deleteNote = useCallback((noteId: string) => {
    setSavedNotes(prev => prev.filter(n => n.id !== noteId))
    if (activeNoteId === noteId) {
      clearFields()
    }
  }, [activeNoteId, clearFields])

  const copyToClipboard = useCallback(async () => {
    const formatted = [
      `=== ${title || 'Untitled'} ===`,
      '',
      '--- CUES ---',
      cues,
      '',
      '--- NOTES ---',
      notes,
      '',
      '--- SUMMARY ---',
      summary,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(formatted)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }, [title, cues, notes, summary])

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        <div className="space-y-6">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Note title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="input-field flex-1 min-w-[200px]"
            />
            <button onClick={handleSave} className="btn-primary flex items-center gap-2">
              <Save size={16} />
              Save
            </button>
            <button onClick={clearFields} className="btn-secondary flex items-center gap-2">
              <Plus size={16} />
              New
            </button>
            <button
              onClick={copyToClipboard}
              className="btn-secondary flex items-center gap-2"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Saved notes dropdown */}
          {savedNotes.length > 0 && (
            <div className="glass-card p-4">
              <h2 className="text-surface-400 text-xs font-medium uppercase tracking-wider mb-2">
                Saved Notes
              </h2>
              <div className="space-y-2">
                {savedNotes.map(note => (
                  <div
                    key={note.id}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                      activeNoteId === note.id
                        ? 'bg-primary-500/10 border border-primary-400/20'
                        : 'bg-surface-900/30 hover:bg-surface-800/50'
                    }`}
                  >
                    <button
                      onClick={() => loadNote(note.id)}
                      className="text-left flex-1"
                    >
                      <p className="text-surface-200 text-sm font-medium">{note.title}</p>
                      <p className="text-surface-500 text-xs">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </p>
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="p-1.5 text-surface-500 hover:text-red-400 transition-colors shrink-0"
                      aria-label="Delete note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cornell layout */}
          <div className="glass-card overflow-hidden">
            {/* Top row: Cues + Notes */}
            <div className="flex flex-col md:flex-row">
              {/* Cues column */}
              <div className="w-full md:w-[30%] border-b md:border-b-0 md:border-r border-primary-500/10 p-4">
                <label className="font-[family-name:var(--font-display)] text-sm font-semibold text-primary-400 uppercase tracking-wider block mb-2">
                  Cues
                </label>
                <p className="text-surface-500 text-xs mb-3">
                  Key questions, terms, or prompts
                </p>
                <textarea
                  value={cues}
                  onChange={e => setCues(e.target.value)}
                  placeholder="Write key questions and terms..."
                  rows={12}
                  className="input-field w-full resize-y"
                />
              </div>

              {/* Notes column */}
              <div className="w-full md:w-[70%] p-4">
                <label className="font-[family-name:var(--font-display)] text-sm font-semibold text-primary-400 uppercase tracking-wider block mb-2">
                  Notes
                </label>
                <p className="text-surface-500 text-xs mb-3">
                  Detailed notes, ideas, and explanations
                </p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Write detailed notes here..."
                  rows={12}
                  className="input-field w-full resize-y"
                />
              </div>
            </div>

            {/* Summary row */}
            <div className="border-t border-primary-500/10 p-4">
              <label className="font-[family-name:var(--font-display)] text-sm font-semibold text-primary-400 uppercase tracking-wider block mb-2">
                Summary
              </label>
              <p className="text-surface-500 text-xs mb-3">
                Summarize the key points in your own words
              </p>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="Write a brief summary..."
                rows={4}
                className="input-field w-full resize-y"
              />
            </div>
          </div>

        </div>
      </FormToolPage>
    </>
  )
}
