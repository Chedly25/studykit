import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Shuffle, Download, Upload, ArrowLeft, Check, X, RotateCcw, BookOpen } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('flashcard-maker')!

const STORAGE_KEY = 'studykit-flashcard-decks'

interface FlashCard {
  id: string
  front: string
  back: string
}

interface Deck {
  id: string
  name: string
  cards: FlashCard[]
}

type Mode = 'manage' | 'study'

interface StudyResult {
  known: string[]
  review: string[]
}

function generateId(): string {
  return crypto.randomUUID()
}

function loadDecks(): Deck[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Deck[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // ignore
  }
  return []
}

function saveDecks(decks: Deck[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks))
}

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }
  return shuffled
}

export default function FlashcardMaker() {
  const [decks, setDecks] = useState<Deck[]>(loadDecks)
  const [mode, setMode] = useState<Mode>('manage')
  const [expandedDeckId, setExpandedDeckId] = useState<string | null>(null)
  const [newDeckName, setNewDeckName] = useState('')
  const [newCardFront, setNewCardFront] = useState('')
  const [newCardBack, setNewCardBack] = useState('')

  // Study state
  const [studyDeckId, setStudyDeckId] = useState<string | null>(null)
  const [studyCards, setStudyCards] = useState<FlashCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<StudyResult>({ known: [], review: [] })
  const [studyComplete, setStudyComplete] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveDecks(decks)
  }, [decks])

  // Deck management
  const createDeck = useCallback(() => {
    const trimmed = newDeckName.trim()
    if (!trimmed) return
    setDecks(prev => [...prev, { id: generateId(), name: trimmed, cards: [] }])
    setNewDeckName('')
  }, [newDeckName])

  const deleteDeck = useCallback((deckId: string) => {
    setDecks(prev => prev.filter(d => d.id !== deckId))
    if (expandedDeckId === deckId) setExpandedDeckId(null)
  }, [expandedDeckId])

  const addCard = useCallback((deckId: string) => {
    const front = newCardFront.trim()
    const back = newCardBack.trim()
    if (!front || !back) return
    setDecks(prev =>
      prev.map(d =>
        d.id === deckId
          ? { ...d, cards: [...d.cards, { id: generateId(), front, back }] }
          : d
      )
    )
    setNewCardFront('')
    setNewCardBack('')
  }, [newCardFront, newCardBack])

  const removeCard = useCallback((deckId: string, cardId: string) => {
    setDecks(prev =>
      prev.map(d =>
        d.id === deckId
          ? { ...d, cards: d.cards.filter(c => c.id !== cardId) }
          : d
      )
    )
  }, [])

  // Study mode
  const startStudy = useCallback((deckId: string) => {
    const deck = decks.find(d => d.id === deckId)
    if (!deck || deck.cards.length === 0) return
    setStudyDeckId(deckId)
    setStudyCards(fisherYatesShuffle(deck.cards))
    setCurrentIndex(0)
    setFlipped(false)
    setResults({ known: [], review: [] })
    setStudyComplete(false)
    setMode('study')
  }, [decks])

  const markCard = useCallback((status: 'known' | 'review') => {
    const currentCard = studyCards[currentIndex]
    if (!currentCard) return

    setResults(prev => ({
      ...prev,
      [status]: [...prev[status], currentCard.id],
    }))

    if (currentIndex + 1 >= studyCards.length) {
      setStudyComplete(true)
    } else {
      setCurrentIndex(prev => prev + 1)
      setFlipped(false)
    }
  }, [studyCards, currentIndex])

  const reshuffleStudy = useCallback(() => {
    setStudyCards(prev => fisherYatesShuffle(prev))
    setCurrentIndex(0)
    setFlipped(false)
    setResults({ known: [], review: [] })
    setStudyComplete(false)
  }, [])

  const exitStudy = useCallback(() => {
    setMode('manage')
    setStudyDeckId(null)
    setStudyCards([])
    setStudyComplete(false)
  }, [])

  // Import / Export
  const exportDeck = useCallback((deck: Deck) => {
    const json = JSON.stringify(deck, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deck.name.replace(/\s+/g, '-').toLowerCase()}-flashcards.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const importDeck = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Deck
        if (parsed.name && Array.isArray(parsed.cards)) {
          const imported: Deck = {
            id: generateId(),
            name: parsed.name,
            cards: parsed.cards.map(c => ({
              id: generateId(),
              front: String(c.front),
              back: String(c.back),
            })),
          }
          setDecks(prev => [...prev, imported])
        }
      } catch {
        // invalid file
      }
    }
    reader.readAsText(file)
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const studyDeck = studyDeckId ? decks.find(d => d.id === studyDeckId) : null

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>

        {mode === 'manage' && (
          <div className="space-y-6">
            {/* Create deck */}
            <div className="glass-card p-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-surface-100 mb-3">
                Create New Deck
              </h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Deck name..."
                  value={newDeckName}
                  onChange={e => setNewDeckName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createDeck()}
                  className="input-field flex-1"
                />
                <button onClick={createDeck} className="btn-primary flex items-center gap-2">
                  <Plus size={16} />
                  Create
                </button>
              </div>
            </div>

            {/* Import button */}
            <div className="flex justify-end">
              <label className="btn-secondary flex items-center gap-2 cursor-pointer">
                <Upload size={16} />
                Import Deck
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={importDeck}
                  className="hidden"
                />
              </label>
            </div>

            {/* Deck list */}
            {decks.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <BookOpen size={40} className="mx-auto text-surface-500 mb-3" />
                <p className="text-surface-400">No decks yet. Create one above to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {decks.map(deck => (
                  <div key={deck.id} className="glass-card overflow-hidden">
                    {/* Deck header */}
                    <div className="p-4 flex items-center justify-between">
                      <button
                        onClick={() => setExpandedDeckId(expandedDeckId === deck.id ? null : deck.id)}
                        className="text-left flex-1"
                      >
                        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-surface-100">
                          {deck.name}
                        </h3>
                        <p className="text-surface-400 text-sm">
                          {deck.cards.length} card{deck.cards.length !== 1 ? 's' : ''}
                        </p>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => exportDeck(deck)}
                          className="p-2 text-surface-400 hover:text-primary-400 transition-colors"
                          aria-label="Export deck"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => startStudy(deck.id)}
                          disabled={deck.cards.length === 0}
                          className="btn-primary text-sm px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Study
                        </button>
                        <button
                          onClick={() => deleteDeck(deck.id)}
                          className="p-2 text-surface-500 hover:text-red-400 transition-colors"
                          aria-label="Delete deck"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded: cards */}
                    {expandedDeckId === deck.id && (
                      <div className="border-t border-primary-500/10 p-4 space-y-3">
                        {/* Existing cards */}
                        {deck.cards.map(card => (
                          <div
                            key={card.id}
                            className="flex items-start gap-3 p-3 rounded-lg bg-surface-900/50"
                          >
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <span className="text-surface-500 text-xs uppercase tracking-wider">Front</span>
                                <p className="text-surface-200 text-sm mt-0.5">{card.front}</p>
                              </div>
                              <div>
                                <span className="text-surface-500 text-xs uppercase tracking-wider">Back</span>
                                <p className="text-surface-200 text-sm mt-0.5">{card.back}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeCard(deck.id, card.id)}
                              className="p-1.5 text-surface-500 hover:text-red-400 transition-colors shrink-0"
                              aria-label="Remove card"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}

                        {/* Add card form */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Front side..."
                            value={newCardFront}
                            onChange={e => setNewCardFront(e.target.value)}
                            className="input-field"
                          />
                          <input
                            type="text"
                            placeholder="Back side..."
                            value={newCardBack}
                            onChange={e => setNewCardBack(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addCard(deck.id)}
                            className="input-field"
                          />
                        </div>
                        <button
                          onClick={() => addCard(deck.id)}
                          className="btn-secondary flex items-center gap-2 text-sm"
                        >
                          <Plus size={14} />
                          Add Card
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'study' && studyDeck && (
          <div className="space-y-6">
            {/* Study header */}
            <div className="flex items-center justify-between">
              <button
                onClick={exitStudy}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <ArrowLeft size={16} />
                Back to Decks
              </button>
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-surface-100">
                {studyDeck.name}
              </h2>
              <button
                onClick={reshuffleStudy}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Shuffle size={16} />
                Shuffle
              </button>
            </div>

            {!studyComplete ? (
              <>
                {/* Progress */}
                <div className="text-center">
                  <p className="text-surface-400 text-sm">
                    Card {currentIndex + 1} of {studyCards.length}
                  </p>
                  <div className="w-full bg-surface-800 rounded-full h-2 mt-2">
                    <div
                      className="bg-primary-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${((currentIndex + 1) / studyCards.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Flashcard with 3D flip */}
                <div
                  className="mx-auto max-w-lg cursor-pointer"
                  style={{ perspective: '1000px' }}
                  onClick={() => setFlipped(prev => !prev)}
                >
                  <div
                    style={{
                      transform: flipped ? 'rotateY(180deg)' : '',
                      transition: 'transform 0.5s',
                      transformStyle: 'preserve-3d',
                    }}
                    className="relative w-full min-h-[250px]"
                  >
                    {/* Front face */}
                    <div
                      className="glass-card p-8 absolute inset-0 flex flex-col items-center justify-center"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <span className="text-surface-500 text-xs uppercase tracking-wider mb-3">Front</span>
                      <p className="text-surface-100 text-xl text-center font-medium">
                        {studyCards[currentIndex]?.front}
                      </p>
                      <p className="text-surface-500 text-xs mt-4">Click to flip</p>
                    </div>

                    {/* Back face */}
                    <div
                      className="glass-card p-8 absolute inset-0 flex flex-col items-center justify-center"
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    >
                      <span className="text-surface-500 text-xs uppercase tracking-wider mb-3">Back</span>
                      <p className="text-surface-100 text-xl text-center font-medium">
                        {studyCards[currentIndex]?.back}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mark buttons */}
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => markCard('review')}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors font-medium"
                  >
                    <X size={18} />
                    Review
                  </button>
                  <button
                    onClick={() => markCard('known')}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors font-medium"
                  >
                    <Check size={18} />
                    Known
                  </button>
                </div>
              </>
            ) : (
              /* Study complete */
              <div className="glass-card p-8 text-center space-y-4">
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold text-surface-100">
                  Session Complete!
                </h3>
                <div className="flex justify-center gap-8">
                  <div>
                    <p className="text-3xl font-bold text-emerald-400">{results.known.length}</p>
                    <p className="text-surface-400 text-sm">Known</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-400">{results.review.length}</p>
                    <p className="text-surface-400 text-sm">To Review</p>
                  </div>
                </div>
                <p className="text-surface-300">
                  {studyCards.length > 0
                    ? `${Math.round((results.known.length / studyCards.length) * 100)}% mastered`
                    : '0% mastered'}
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={reshuffleStudy} className="btn-primary flex items-center gap-2">
                    <RotateCcw size={16} />
                    Study Again
                  </button>
                  <button onClick={exitStudy} className="btn-secondary flex items-center gap-2">
                    <ArrowLeft size={16} />
                    Back to Decks
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </FormToolPage>
    </>
  )
}
