import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, Trash2, Download, Upload, ArrowLeft, RotateCcw, BookOpen, BarChart3 } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'
import { calculateSM2, getDueCards, createNewCard, type SM2Card } from '../../lib/spacedRepetition'

const tool = getToolBySlug('flashcard-maker')!

const STORAGE_KEY = 'studieskit-smart-flashcards'

interface Deck {
  id: string
  name: string
  cards: SM2Card[]
}

type Mode = 'manage' | 'study' | 'stats'

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

const RATING_BUTTONS = [
  { quality: 0, label: 'Again', color: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' },
  { quality: 2, label: 'Hard', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20' },
  { quality: 3, label: 'Good', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20' },
  { quality: 5, label: 'Easy', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' },
]

export default function FlashcardMaker() {
  const [decks, setDecks] = useState<Deck[]>(loadDecks)
  const [mode, setMode] = useState<Mode>('manage')
  const [expandedDeckId, setExpandedDeckId] = useState<string | null>(null)
  const [newDeckName, setNewDeckName] = useState('')
  const [newCardFront, setNewCardFront] = useState('')
  const [newCardBack, setNewCardBack] = useState('')

  // Study state
  const [studyDeckId, setStudyDeckId] = useState<string | null>(null)
  const [studyCards, setStudyCards] = useState<SM2Card[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [studyComplete, setStudyComplete] = useState(false)
  const [sessionReviewed, setSessionReviewed] = useState(0)

  // Stats state
  const [statsDeckId, setStatsDeckId] = useState<string | null>(null)

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
    const card = createNewCard(generateId(), front, back)
    setDecks(prev =>
      prev.map(d =>
        d.id === deckId
          ? { ...d, cards: [...d.cards, card] }
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
    const due = getDueCards(deck.cards)
    const cardsToStudy = due.length > 0 ? fisherYatesShuffle(due) : fisherYatesShuffle(deck.cards)
    setStudyDeckId(deckId)
    setStudyCards(cardsToStudy)
    setCurrentIndex(0)
    setFlipped(false)
    setStudyComplete(false)
    setSessionReviewed(0)
    setMode('study')
  }, [decks])

  const rateCard = useCallback((quality: number) => {
    const currentCard = studyCards[currentIndex]
    if (!currentCard) return

    const result = calculateSM2(quality, currentCard)
    const updatedCard: SM2Card = {
      ...currentCard,
      easeFactor: result.easeFactor,
      interval: result.interval,
      repetitions: result.repetitions,
      nextReviewDate: result.nextReviewDate,
      lastRating: quality,
    }

    // Update in decks
    setDecks(prev =>
      prev.map(d =>
        d.id === studyDeckId
          ? { ...d, cards: d.cards.map(c => c.id === updatedCard.id ? updatedCard : c) }
          : d
      )
    )

    setSessionReviewed(prev => prev + 1)

    if (currentIndex + 1 >= studyCards.length) {
      setStudyComplete(true)
    } else {
      setCurrentIndex(prev => prev + 1)
      setFlipped(false)
    }
  }, [studyCards, currentIndex, studyDeckId])

  const exitStudy = useCallback(() => {
    setMode('manage')
    setStudyDeckId(null)
    setStudyCards([])
    setStudyComplete(false)
  }, [])

  // Stats mode
  const showStats = useCallback((deckId: string) => {
    setStatsDeckId(deckId)
    setMode('stats')
  }, [])

  const statsDeck = statsDeckId ? decks.find(d => d.id === statsDeckId) : null

  const statsData = useMemo(() => {
    if (!statsDeck) return null
    const cards = statsDeck.cards
    const today = new Date().toISOString().slice(0, 10)
    const dueToday = cards.filter(c => c.nextReviewDate <= today).length
    const mastered = cards.filter(c => c.repetitions >= 3 && c.easeFactor >= 2.0).length
    const avgEase = cards.length > 0
      ? cards.reduce((sum, c) => sum + c.easeFactor, 0) / cards.length
      : 0

    // Upcoming schedule (next 7 days)
    const upcoming: { date: string; count: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const count = cards.filter(c => c.nextReviewDate === dateStr).length
      upcoming.push({ date: dateStr, count })
    }

    return { dueToday, mastered, total: cards.length, avgEase, upcoming }
  }, [statsDeck])

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
        const text = reader.result as string

        // Try JSON first
        const parsed = JSON.parse(text)
        if (parsed.name && Array.isArray(parsed.cards)) {
          const imported: Deck = {
            id: generateId(),
            name: parsed.name,
            cards: parsed.cards.map((c: Record<string, unknown>) => {
              if (c.easeFactor !== undefined) {
                // SM2Card format
                return {
                  id: generateId(),
                  front: String(c.front ?? ''),
                  back: String(c.back ?? ''),
                  easeFactor: Number(c.easeFactor) || 2.5,
                  interval: Number(c.interval) || 0,
                  repetitions: Number(c.repetitions) || 0,
                  nextReviewDate: typeof c.nextReviewDate === 'string' ? c.nextReviewDate : new Date().toISOString().slice(0, 10),
                  lastRating: Number(c.lastRating) || 0,
                }
              }
              // Simple front/back format
              return createNewCard(generateId(), String(c.front), String(c.back))
            }),
          }
          setDecks(prev => [...prev, imported])
        }
      } catch {
        // Try CSV: front,back per line
        try {
          const text = reader.result as string
          const lines = text.trim().split('\n').filter(l => l.includes(','))
          if (lines.length > 0) {
            const cards = lines.map(line => {
              const [front, ...rest] = line.split(',')
              return createNewCard(generateId(), front.trim(), rest.join(',').trim())
            })
            const imported: Deck = {
              id: generateId(),
              name: file.name.replace(/\.[^.]+$/, ''),
              cards,
            }
            setDecks(prev => [...prev, imported])
          }
        } catch {
          // invalid file
        }
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const studyDeck = studyDeckId ? decks.find(d => d.id === studyDeckId) : null

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>

        {/* ─── MANAGE MODE ─── */}
        {mode === 'manage' && (
          <div className="space-y-6">
            {/* Create deck */}
            <div className="glass-card p-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-heading)] mb-3">
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
                  accept=".json,.csv"
                  onChange={importDeck}
                  className="hidden"
                />
              </label>
            </div>

            {/* Deck list */}
            {decks.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <BookOpen size={40} className="mx-auto text-[var(--text-faint)] mb-3" />
                <p className="text-[var(--text-muted)]">No decks yet. Create one above to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {decks.map(deck => {
                  const dueCount = getDueCards(deck.cards).length
                  return (
                    <div key={deck.id} className="glass-card overflow-hidden">
                      {/* Deck header */}
                      <div className="p-4 flex items-center justify-between">
                        <button
                          onClick={() => setExpandedDeckId(expandedDeckId === deck.id ? null : deck.id)}
                          className="text-left flex-1"
                        >
                          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-heading)]">
                            {deck.name}
                          </h3>
                          <p className="text-[var(--text-muted)] text-sm">
                            {deck.cards.length} card{deck.cards.length !== 1 ? 's' : ''}
                            {dueCount > 0 && (
                              <span className="ml-2 text-[var(--accent-text)] font-medium">
                                {dueCount} due
                              </span>
                            )}
                          </p>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => showStats(deck.id)}
                            className="p-2 text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
                            aria-label="View stats"
                          >
                            <BarChart3 size={16} />
                          </button>
                          <button
                            onClick={() => exportDeck(deck)}
                            className="p-2 text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
                            aria-label="Export deck"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={() => startStudy(deck.id)}
                            disabled={deck.cards.length === 0}
                            className="btn-primary text-sm px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Study{dueCount > 0 ? ` (${dueCount})` : ''}
                          </button>
                          <button
                            onClick={() => deleteDeck(deck.id)}
                            className="p-2 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                            aria-label="Delete deck"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded: cards */}
                      {expandedDeckId === deck.id && (
                        <div className="border-t border-[var(--border-card)] p-4 space-y-3">
                          {deck.cards.map(card => (
                            <div
                              key={card.id}
                              className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-input)]"
                            >
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[var(--text-faint)] text-xs uppercase tracking-wider">Front</span>
                                  <p className="text-[var(--text-body)] text-sm mt-0.5">{card.front}</p>
                                </div>
                                <div>
                                  <span className="text-[var(--text-faint)] text-xs uppercase tracking-wider">Back</span>
                                  <p className="text-[var(--text-body)] text-sm mt-0.5">{card.back}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[var(--text-faint)] text-[10px]">EF {card.easeFactor.toFixed(1)}</p>
                                <button
                                  onClick={() => removeCard(deck.id, card.id)}
                                  className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                                  aria-label="Remove card"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
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
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── STUDY MODE ─── */}
        {mode === 'study' && studyDeck && (
          <div className="space-y-6">
            {/* Study header */}
            <div className="flex items-center justify-between">
              <button
                onClick={exitStudy}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-heading)]">
                {studyDeck.name}
              </h2>
              <div className="w-20" />
            </div>

            {!studyComplete ? (
              <>
                {/* Progress */}
                <div className="text-center">
                  <p className="text-[var(--text-muted)] text-sm">
                    Card {currentIndex + 1} of {studyCards.length}
                  </p>
                  <div className="w-full bg-[var(--border-card)] rounded-full h-2 mt-2">
                    <div
                      className="bg-[var(--accent-text)] h-2 rounded-full transition-all duration-300"
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
                    <div
                      className="glass-card p-8 absolute inset-0 flex flex-col items-center justify-center"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <span className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-3">Front</span>
                      <p className="text-[var(--text-heading)] text-xl text-center font-medium">
                        {studyCards[currentIndex]?.front}
                      </p>
                      <p className="text-[var(--text-faint)] text-xs mt-4">Click to flip</p>
                    </div>

                    <div
                      className="glass-card p-8 absolute inset-0 flex flex-col items-center justify-center"
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    >
                      <span className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-3">Back</span>
                      <p className="text-[var(--text-heading)] text-xl text-center font-medium">
                        {studyCards[currentIndex]?.back}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rating buttons */}
                {flipped && (
                  <div className="flex justify-center gap-3 animate-fade-in">
                    {RATING_BUTTONS.map(btn => (
                      <button
                        key={btn.quality}
                        onClick={() => rateCard(btn.quality)}
                        className={`px-5 py-3 rounded-xl border font-medium transition-colors ${btn.color}`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Study complete */
              <div className="glass-card p-8 text-center space-y-4">
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">
                  Session Complete!
                </h3>
                <p className="text-[var(--text-body)]">
                  You reviewed <span className="font-bold text-[var(--accent-text)]">{sessionReviewed}</span> cards
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => startStudy(studyDeckId!)} className="btn-primary flex items-center gap-2">
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

        {/* ─── STATS MODE ─── */}
        {mode === 'stats' && statsDeck && statsData && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMode('manage')}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-heading)]">
                {statsDeck.name} — Stats
              </h2>
              <div className="w-20" />
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass-card p-4 text-center">
                <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--accent-text)]">{statsData.dueToday}</p>
                <p className="text-[var(--text-muted)] text-sm">Due Today</p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-emerald-400">{statsData.mastered}</p>
                <p className="text-[var(--text-muted)] text-sm">Mastered</p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)]">{statsData.total}</p>
                <p className="text-[var(--text-muted)] text-sm">Total Cards</p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-blue-400">{statsData.avgEase.toFixed(2)}</p>
                <p className="text-[var(--text-muted)] text-sm">Avg Ease</p>
              </div>
            </div>

            {/* Upcoming schedule */}
            <div className="glass-card p-4">
              <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--text-body)] uppercase tracking-wider mb-4">
                Upcoming Reviews (7 days)
              </h3>
              <div className="space-y-2">
                {statsData.upcoming.map(day => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-[var(--text-body)] text-sm w-24 shrink-0">
                      {new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <div className="flex-1 h-5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500/60 rounded-full transition-all"
                        style={{ width: `${statsData.total > 0 ? Math.max(day.count > 0 ? 4 : 0, (day.count / statsData.total) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-[var(--text-muted)] text-xs w-8 text-right shrink-0">{day.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ease factor distribution */}
            {statsDeck.cards.length > 0 && (
              <div className="glass-card p-4">
                <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--text-body)] uppercase tracking-wider mb-3">
                  Ease Factor Distribution
                </h3>
                <div className="flex flex-wrap gap-2">
                  {statsDeck.cards.map(card => (
                    <div
                      key={card.id}
                      className={`w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-mono font-bold ${
                        card.easeFactor >= 2.5
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : card.easeFactor >= 2.0
                          ? 'bg-blue-500/20 text-blue-400'
                          : card.easeFactor >= 1.5
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                      title={`${card.front}: EF ${card.easeFactor.toFixed(2)}`}
                    >
                      {card.easeFactor.toFixed(1)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </FormToolPage>
    </>
  )
}
