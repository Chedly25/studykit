import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookmarkPlus, Plus, Check } from 'lucide-react'
import { db } from '../../db'
import { toast } from 'sonner'

interface SaveToDeckDropdownProps {
  examProfileId: string
  front: string
  back: string
  topicId?: string
}

export function SaveToDeckDropdown({ examProfileId, front, back, topicId }: SaveToDeckDropdownProps) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')

  const decks = useLiveQuery(
    () => db.flashcardDecks.where('examProfileId').equals(examProfileId).toArray(),
    [examProfileId]
  ) ?? []

  const saveToDeck = async (deckId: string, deckName: string) => {
    const today = new Date().toISOString().slice(0, 10)
    await db.flashcards.put({
      id: crypto.randomUUID(),
      deckId,
      topicId,
      front,
      back,
      source: 'ai-generated' as const,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReviewDate: today,
      lastRating: 0,
    })
    setSaved(true)
    setOpen(false)
    toast.success(`Saved to deck: ${deckName}`)
  }

  const createAndSave = async () => {
    if (!newDeckName.trim()) return
    const deckId = crypto.randomUUID()
    await db.flashcardDecks.put({
      id: deckId,
      examProfileId,
      name: newDeckName.trim(),
      createdAt: new Date().toISOString(),
    })
    await saveToDeck(deckId, newDeckName.trim())
    setCreating(false)
    setNewDeckName('')
  }

  if (saved) {
    return (
      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--color-success)]">
        <Check className="w-3 h-3" /> Saved
      </span>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors"
      >
        <BookmarkPlus className="w-3 h-3" /> Save to Deck
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-50 w-56 glass-card shadow-lg rounded-lg p-2 space-y-1">
          {decks.map(deck => (
            <button
              key={deck.id}
              onClick={() => saveToDeck(deck.id, deck.name)}
              className="w-full text-left px-3 py-1.5 rounded text-xs text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors truncate"
            >
              {deck.name}
            </button>
          ))}

          {creating ? (
            <div className="flex gap-1 px-1">
              <input
                autoFocus
                value={newDeckName}
                onChange={e => setNewDeckName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createAndSave()}
                placeholder="Deck name..."
                className="flex-1 text-xs px-2 py-1 rounded bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-body)]"
              />
              <button
                onClick={createAndSave}
                className="px-2 py-1 rounded text-xs font-medium bg-[var(--accent-bg)] text-[var(--accent-text)]"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full text-left px-3 py-1.5 rounded text-xs text-[var(--accent-text)] hover:bg-[var(--bg-input)] transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> New Deck
            </button>
          )}
        </div>
      )}
    </div>
  )
}
