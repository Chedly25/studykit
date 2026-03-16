import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { ResearchNote } from '../db/schema'

export function useResearchNotes(examProfileId: string | undefined) {
  const notes = useLiveQuery(
    () => examProfileId
      ? db.researchNotes.where('examProfileId').equals(examProfileId).reverse().sortBy('updatedAt')
      : Promise.resolve([] as ResearchNote[]),
    [examProfileId]
  ) ?? []

  const createNote = useCallback(async (title: string, content?: string): Promise<string | null> => {
    if (!examProfileId) return null
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await db.researchNotes.put({
      id,
      examProfileId,
      title,
      content: content ?? '',
      linkedNoteIds: '[]',
      linkedTopicIds: '[]',
      linkedDocumentIds: '[]',
      tags: '[]',
      createdAt: now,
      updatedAt: now,
    })
    return id
  }, [examProfileId])

  const updateNote = useCallback(async (
    id: string,
    updates: Partial<Pick<ResearchNote, 'title' | 'content' | 'linkedNoteIds' | 'linkedTopicIds' | 'linkedDocumentIds' | 'tags'>>
  ) => {
    await db.researchNotes.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    })
  }, [])

  const deleteNote = useCallback(async (id: string) => {
    // Also remove backlinks from other notes
    const allNotes = await db.researchNotes.where('examProfileId').equals(examProfileId ?? '').toArray()
    for (const note of allNotes) {
      const linked: string[] = JSON.parse(note.linkedNoteIds || '[]')
      if (linked.includes(id)) {
        await db.researchNotes.update(note.id, {
          linkedNoteIds: JSON.stringify(linked.filter(nid => nid !== id)),
        })
      }
    }
    await db.researchNotes.delete(id)
  }, [examProfileId])

  const linkNote = useCallback(async (noteId: string, targetNoteId: string) => {
    const note = await db.researchNotes.get(noteId)
    if (!note) return
    const linked: string[] = JSON.parse(note.linkedNoteIds || '[]')
    if (!linked.includes(targetNoteId)) {
      linked.push(targetNoteId)
      await db.researchNotes.update(noteId, {
        linkedNoteIds: JSON.stringify(linked),
        updatedAt: new Date().toISOString(),
      })
    }
  }, [])

  const unlinkNote = useCallback(async (noteId: string, targetNoteId: string) => {
    const note = await db.researchNotes.get(noteId)
    if (!note) return
    const linked: string[] = JSON.parse(note.linkedNoteIds || '[]')
    await db.researchNotes.update(noteId, {
      linkedNoteIds: JSON.stringify(linked.filter(id => id !== targetNoteId)),
      updatedAt: new Date().toISOString(),
    })
  }, [])

  const getBacklinks = useCallback((noteId: string): ResearchNote[] => {
    return notes.filter(n => {
      const linked: string[] = JSON.parse(n.linkedNoteIds || '[]')
      return linked.includes(noteId)
    })
  }, [notes])

  const searchNotes = useCallback((query: string): ResearchNote[] => {
    const q = query.toLowerCase()
    return notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.toLowerCase().includes(q)
    )
  }, [notes])

  return {
    notes,
    createNote,
    updateNote,
    deleteNote,
    linkNote,
    unlinkNote,
    getBacklinks,
    searchNotes,
  }
}
