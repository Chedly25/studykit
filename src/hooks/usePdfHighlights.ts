/**
 * CRUD hook for PDF highlights — add, update, delete highlights + flashcard creation.
 */
import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { PdfHighlight } from '../db/schema'

export function usePdfHighlights(documentId: string, examProfileId: string | undefined) {
  const highlights = useLiveQuery(
    () => examProfileId
      ? db.pdfHighlights.where('documentId').equals(documentId).filter(h => h.examProfileId === examProfileId).toArray()
      : Promise.resolve([] as PdfHighlight[]),
    [documentId, examProfileId]
  ) ?? []

  const addHighlight = useCallback(async (
    pageNumber: number,
    text: string,
    rects: Array<{ x: number; y: number; width: number; height: number }>,
    color: string,
  ): Promise<string> => {
    if (!examProfileId) return ''
    const id = crypto.randomUUID()
    await db.pdfHighlights.put({
      id,
      documentId,
      examProfileId,
      pageNumber,
      text,
      rects: JSON.stringify(rects),
      color,
      createdAt: new Date().toISOString(),
    })
    return id
  }, [documentId, examProfileId])

  const updateNote = useCallback(async (id: string, note: string) => {
    await db.pdfHighlights.update(id, { note })
  }, [])

  const deleteHighlight = useCallback(async (id: string) => {
    await db.pdfHighlights.delete(id)
  }, [])

  const createFlashcardFromHighlight = useCallback(async (
    id: string,
    front: string,
  ): Promise<string | null> => {
    if (!examProfileId) return null
    const highlight = await db.pdfHighlights.get(id)
    if (!highlight) return null

    const cardId = crypto.randomUUID()

    // Find or create a deck for this document
    let deck = await db.flashcardDecks
      .where('examProfileId').equals(examProfileId)
      .filter(d => d.name.includes('PDF Highlights'))
      .first()

    if (!deck) {
      deck = {
        id: crypto.randomUUID(),
        examProfileId,
        name: 'PDF Highlights',
        createdAt: new Date().toISOString(),
      }
      await db.flashcardDecks.put(deck)
    }

    await db.flashcards.put({
      id: cardId,
      deckId: deck.id,
      front,
      back: highlight.text,
      source: 'manual',
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReviewDate: new Date().toISOString().slice(0, 10),
      lastRating: 0,
    })

    // Link highlight to flashcard
    await db.pdfHighlights.update(id, { flashcardId: cardId })

    return cardId
  }, [examProfileId])

  const getHighlightsForPage = useCallback((pageNumber: number): PdfHighlight[] => {
    return highlights.filter(h => h.pageNumber === pageNumber)
  }, [highlights])

  return {
    highlights,
    addHighlight,
    updateNote,
    deleteHighlight,
    createFlashcardFromHighlight,
    getHighlightsForPage,
  }
}
