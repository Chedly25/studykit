import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, Trash2, Download, Upload, ArrowLeft, RotateCcw, BookOpen, BarChart3, Loader2, Brain, Layers, GraduationCap, Sparkles } from 'lucide-react'
import { useAuth } from '@clerk/clerk-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'
import { useFlashcards } from '../../hooks/useFlashcards'
import { useExamProfile } from '../../hooks/useExamProfile'
import { useKnowledgeGraph } from '../../hooks/useKnowledgeGraph'
import { streamChat } from '../../ai/client'
import { db } from '../../db'
import type { Flashcard } from '../../db/schema'
import { decayedMastery } from '../../lib/knowledgeGraph'
import { recordStudyActivity } from '../../lib/studyActivity'
import { SessionCompletionOverlay, type SessionCompletionData } from '../../components/SessionCompletionOverlay'

const tool = getToolBySlug('flashcard-maker')!

type Mode = 'manage' | 'study' | 'stats'

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
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const { streak, weeklyHours, topicsWithDecay } = useKnowledgeGraph(activeProfile?.id)
  const masterySnapshotRef = useRef<Map<string, number>>(new Map())
  const [completionData, setCompletionData] = useState<SessionCompletionData | null>(null)
  const {
    decks, isLoading, getCardsForDeck, getDueCount, getStatsForDeck,
    createDeck: hookCreateDeck, deleteDeck: hookDeleteDeck,
    addCard: hookAddCard, removeCard: hookRemoveCard,
    rateCard: hookRateCard, importDeck: hookImportDeck, exportDeck: hookExportDeck,
  } = useFlashcards(activeProfile?.id)

  const [mode, setMode] = useState<Mode>('manage')
  useEffect(() => { window.scrollTo(0, 0) }, [mode])
  const [expandedDeckId, setExpandedDeckId] = useState<string | null>(null)
  const [newDeckName, setNewDeckName] = useState('')
  const [newCardFront, setNewCardFront] = useState('')
  const [newCardBack, setNewCardBack] = useState('')

  // Study state
  const [studyDeckId, setStudyDeckId] = useState<string | null>(null)
  const [studyCards, setStudyCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [studyComplete, setStudyComplete] = useState(false)
  const [sessionReviewed, setSessionReviewed] = useState(0)

  // Stats state
  const [statsDeckId, setStatsDeckId] = useState<string | null>(null)

  // AI generation state
  const [aiTopic, setAiTopic] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiDeckId, setAiDeckId] = useState<string | null>(null)
  const [aiCardCount, setAiCardCount] = useState(10)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const studyStartTimeRef = useRef<number>(0)

  // Deck management
  const createDeck = useCallback(() => {
    const trimmed = newDeckName.trim()
    if (!trimmed) return
    hookCreateDeck(trimmed)
    setNewDeckName('')
  }, [newDeckName, hookCreateDeck])

  const deleteDeck = useCallback((deckId: string) => {
    hookDeleteDeck(deckId)
    if (expandedDeckId === deckId) setExpandedDeckId(null)
  }, [expandedDeckId, hookDeleteDeck])

  const addCard = useCallback((deckId: string) => {
    const front = newCardFront.trim()
    const back = newCardBack.trim()
    if (!front || !back) return
    hookAddCard(deckId, front, back)
    setNewCardFront('')
    setNewCardBack('')
  }, [newCardFront, newCardBack, hookAddCard])

  // Study mode
  const startStudy = useCallback((deckId: string) => {
    const deckCards = getCardsForDeck(deckId)
    if (deckCards.length === 0) return
    const today = new Date().toISOString().slice(0, 10)
    const due = deckCards.filter(c => c.nextReviewDate <= today)
    const cardsToStudy = due.length > 0 ? fisherYatesShuffle(due) : fisherYatesShuffle(deckCards)

    // Snapshot mastery for topics in this deck
    const snapshot = new Map<string, number>()
    const topicIds = new Set(cardsToStudy.map(c => c.topicId).filter(Boolean) as string[])
    for (const tid of topicIds) {
      const t = topicsWithDecay.find(tw => tw.id === tid)
      if (t) snapshot.set(tid, t.decayedMastery)
    }
    masterySnapshotRef.current = snapshot

    setStudyDeckId(deckId)
    setStudyCards(cardsToStudy)
    setCurrentIndex(0)
    setFlipped(false)
    setStudyComplete(false)
    setSessionReviewed(0)
    setCompletionData(null)
    studyStartTimeRef.current = Date.now()
    setMode('study')
  }, [getCardsForDeck, topicsWithDecay])

  const recordSessionActivity = useCallback(async () => {
    if (!activeProfile?.id || studyStartTimeRef.current === 0) return
    const durationSeconds = Math.round((Date.now() - studyStartTimeRef.current) / 1000)
    if (durationSeconds <= 0) return

    // Look up subjectId from the deck's topicId
    const deck = studyDeckId ? decks.find(d => d.id === studyDeckId) : null
    let subjectId: string | undefined
    if (deck?.topicId) {
      const topic = await db.topics.get(deck.topicId)
      subjectId = topic?.subjectId
    }

    await recordStudyActivity({
      examProfileId: activeProfile.id,
      durationSeconds,
      subjectId,
      type: 'review',
    })
  }, [activeProfile?.id, studyDeckId, decks])

  const rateCard = useCallback(async (quality: number) => {
    const currentCard = studyCards[currentIndex]
    if (!currentCard) return

    await hookRateCard(currentCard.id, quality)
    const newReviewed = sessionReviewed + 1
    setSessionReviewed(newReviewed)

    if (currentIndex + 1 >= studyCards.length) {
      setStudyComplete(true)
      await recordSessionActivity()

      // Build mastery deltas from snapshot
      const deltas: Array<{ topicName: string; before: number; after: number }> = []
      for (const [tid, beforeVal] of masterySnapshotRef.current) {
        const topic = await db.topics.get(tid)
        if (topic) {
          deltas.push({ topicName: topic.name, before: beforeVal, after: decayedMastery(topic) })
        }
      }

      const deckName = studyDeckId ? decks.find(d => d.id === studyDeckId)?.name ?? 'Deck' : 'Deck'
      setCompletionData({
        activityType: 'flashcards',
        timeSpentSeconds: Math.round((Date.now() - studyStartTimeRef.current) / 1000),
        streak,
        weeklyHours,
        weeklyTarget: 10,
        masteryDeltas: deltas.length > 0 ? deltas : undefined,
        flashcardStats: { cardsReviewed: newReviewed, deckName },
      })
    } else {
      setCurrentIndex(prev => prev + 1)
      setFlipped(false)
    }
  }, [studyCards, currentIndex, hookRateCard, recordSessionActivity, sessionReviewed, studyDeckId, decks, streak, weeklyHours])

  const exitStudy = useCallback(() => {
    // Fire-and-forget activity recording for partial sessions so UI transitions immediately
    if (sessionReviewed > 0 && !studyComplete) {
      recordSessionActivity().catch(() => {})
    }
    setMode('manage')
    setStudyDeckId(null)
    setStudyCards([])
    setStudyComplete(false)
    studyStartTimeRef.current = 0
  }, [sessionReviewed, studyComplete, recordSessionActivity])

  // Stats mode
  const showStats = useCallback((deckId: string) => {
    setStatsDeckId(deckId)
    setMode('stats')
  }, [])

  const statsDeck = statsDeckId ? decks.find(d => d.id === statsDeckId) : null
  const statsData = statsDeck ? getStatsForDeck(statsDeck.id) : null
  const statsCards = statsDeck ? getCardsForDeck(statsDeck.id) : []

  // Import / Export
  const importDeck = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    hookImportDeck(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [hookImportDeck])

  // AI generation
  const generateWithAI = useCallback(async (deckId: string) => {
    const topic = aiTopic.trim()
    if (!topic) return
    setAiGenerating(true)
    setAiError('')
    setAiDeckId(deckId)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const response = await streamChat({
        messages: [{ role: 'user', content: `Generate exactly ${aiCardCount} flashcards about: ${topic}` }],
        system: `You generate flashcards for studying. Return ONLY a JSON object with this exact format, no other text:\n{"cards":[{"front":"question or term","back":"answer or definition"}]}\n\nGenerate exactly ${aiCardCount} clear, concise flashcards that test key concepts. Each "front" should be a question or term, and "back" should be the answer or definition.`,
        tools: [],
        authToken: token,
      })

      const text = response.content.find(c => c.type === 'text')
      if (!text || text.type !== 'text') throw new Error('No response from AI')

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.text.match(/\{[\s\S]*"cards"[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Could not parse AI response')

      const parsed = JSON.parse(jsonMatch[0]) as { cards: Array<{ front: string; back: string }> }
      if (!parsed.cards?.length) throw new Error('AI returned no cards')

      const today = new Date().toISOString().slice(0, 10)
      const flashcards: Flashcard[] = parsed.cards.map(c => ({
        id: crypto.randomUUID(),
        deckId,
        front: c.front,
        back: c.back,
        source: 'ai-generated' as const,
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: today,
        lastRating: 0,
      }))

      await db.flashcards.bulkPut(flashcards)
      setAiTopic('')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setAiGenerating(false)
      setAiDeckId(null)
    }
  }, [aiTopic, getToken])

  const studyDeck = studyDeckId ? decks.find(d => d.id === studyDeckId) : null

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>

        {isLoading ? (
          <div className="glass-card p-8 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : (
        <>
        {/* ─── MANAGE MODE ─── */}
        {mode === 'manage' && (
          <div className="space-y-6">

            {/* How it works — only show when no decks */}
            {decks.length === 0 && (
              <div className="glass-card p-6 space-y-4">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-heading)]">
                  How Flashcards Work
                </h2>
                <p className="text-[var(--text-body)] text-sm leading-relaxed">
                  Flashcards use <span className="font-medium text-[var(--text-heading)]">spaced repetition</span> to help you memorize anything. Each card has a question on the front and the answer on the back. When you study, you see the question, try to recall the answer, then rate how well you remembered. Cards you struggle with come back sooner; cards you know well appear less often.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-input)]">
                    <Layers size={20} className="text-[var(--accent-text)] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[var(--text-heading)] text-sm font-medium">1. Create a deck</p>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5">Group cards by subject, chapter, or topic</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-input)]">
                    <Brain size={20} className="text-[var(--accent-text)] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[var(--text-heading)] text-sm font-medium">2. Add cards</p>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5">Write a question/term and its answer/definition</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-input)]">
                    <GraduationCap size={20} className="text-[var(--accent-text)] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[var(--text-heading)] text-sm font-medium">3. Study & rate</p>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5">Flip each card, rate your recall — the system schedules reviews for you</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Create deck */}
            <div className="glass-card p-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-heading)] mb-1">
                Create New Deck
              </h2>
              <p className="text-[var(--text-muted)] text-sm mb-3">
                A deck is a collection of flashcards on one topic (e.g. &ldquo;Biology Ch. 5&rdquo; or &ldquo;Spanish Verbs&rdquo;)
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="e.g. Organic Chemistry Reactions"
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
                <p className="text-[var(--text-faint)] text-xs mt-2">Tip: You can also ask the AI tutor to generate flashcards for any topic</p>
              </div>
            ) : (
              <div className="space-y-3">
                {decks.map(deck => {
                  const deckCards = getCardsForDeck(deck.id)
                  const dueCount = getDueCount(deck.id)
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
                            {deckCards.length} card{deckCards.length !== 1 ? 's' : ''}
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
                            onClick={() => hookExportDeck(deck.id)}
                            className="p-2 text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
                            aria-label="Export deck"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={() => startStudy(deck.id)}
                            disabled={deckCards.length === 0}
                            className="btn-primary text-sm px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {dueCount > 0 ? `Review ${dueCount} due` : 'Study All'}
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
                          {deckCards.map(card => (
                            <div
                              key={card.id}
                              className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-input)]"
                            >
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[var(--text-faint)] text-xs uppercase tracking-wider">Question</span>
                                  <p className="text-[var(--text-body)] text-sm mt-0.5">{card.front}</p>
                                </div>
                                <div>
                                  <span className="text-[var(--text-faint)] text-xs uppercase tracking-wider">Answer</span>
                                  <p className="text-[var(--text-body)] text-sm mt-0.5">{card.back}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[var(--text-faint)] text-[10px]">EF {card.easeFactor.toFixed(1)}</p>
                                <button
                                  onClick={() => hookRemoveCard(card.id)}
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
                            <div>
                              <label className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-1 block">Question / Term</label>
                              <input
                                type="text"
                                placeholder="e.g. What is mitosis?"
                                value={newCardFront}
                                onChange={e => setNewCardFront(e.target.value)}
                                className="input-field"
                              />
                            </div>
                            <div>
                              <label className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-1 block">Answer / Definition</label>
                              <input
                                type="text"
                                placeholder="e.g. Cell division producing two identical cells"
                                value={newCardBack}
                                onChange={e => setNewCardBack(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addCard(deck.id)}
                                className="input-field"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => addCard(deck.id)}
                            className="btn-secondary flex items-center gap-2 text-sm"
                          >
                            <Plus size={14} />
                            Add Card
                          </button>

                          {/* AI Generate */}
                          <div className="border-t border-[var(--border-card)] pt-3 mt-3">
                            <p className="text-[var(--text-heading)] text-sm font-medium mb-2 flex items-center gap-1.5">
                              <Sparkles size={14} className="text-[var(--accent-text)]" />
                              Generate cards with AI
                            </p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="e.g. Photosynthesis, French Revolution, Linear Algebra..."
                                value={aiDeckId === deck.id ? aiTopic : aiTopic}
                                onChange={e => setAiTopic(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !aiGenerating && generateWithAI(deck.id)}
                                disabled={aiGenerating}
                                className="input-field flex-1"
                              />
                              <input
                                type="number"
                                min={3}
                                max={30}
                                value={aiCardCount}
                                onChange={e => setAiCardCount(Math.min(30, Math.max(3, parseInt(e.target.value) || 10)))}
                                disabled={aiGenerating}
                                className="w-14 text-xs text-center bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg px-1 py-1.5 text-[var(--text-body)]"
                                title="Number of cards"
                              />
                              <button
                                onClick={() => generateWithAI(deck.id)}
                                disabled={aiGenerating || !aiTopic.trim()}
                                className="btn-primary flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {aiGenerating && aiDeckId === deck.id ? (
                                  <><Loader2 size={14} className="animate-spin" /> Generating...</>
                                ) : (
                                  <><Sparkles size={14} /> Generate</>
                                )}
                              </button>
                            </div>
                            {aiError && aiDeckId === deck.id && (
                              <p className="text-red-400 text-xs mt-2">{aiError}</p>
                            )}
                          </div>
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
                      <span className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-3">Question</span>
                      <p className="text-[var(--text-heading)] text-xl text-center font-medium">
                        {studyCards[currentIndex]?.front}
                      </p>
                      <p className="text-[var(--text-faint)] text-xs mt-4">Try to recall the answer, then click to reveal</p>
                    </div>

                    <div
                      className="glass-card p-8 absolute inset-0 flex flex-col items-center justify-center"
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    >
                      <span className="text-[var(--text-faint)] text-xs uppercase tracking-wider mb-3">Answer</span>
                      <p className="text-[var(--text-heading)] text-xl text-center font-medium">
                        {studyCards[currentIndex]?.back}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rating buttons */}
                {flipped && (
                  <div className="space-y-2 animate-fade-in">
                    <p className="text-center text-[var(--text-muted)] text-sm">How well did you remember?</p>
                    <div className="flex justify-center gap-3">
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
                    <p className="text-center text-[var(--text-faint)] text-xs">Cards you find harder will appear more often</p>
                  </div>
                )}
              </>
            ) : (
              /* Study complete */
              <>
                {completionData ? (
                  <SessionCompletionOverlay
                    data={completionData}
                    onDismiss={() => { setCompletionData(null); exitStudy() }}
                  />
                ) : (
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
              </>
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
            {statsCards.length > 0 && (
              <div className="glass-card p-4">
                <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--text-body)] uppercase tracking-wider mb-3">
                  Ease Factor Distribution
                </h3>
                <div className="flex flex-wrap gap-2">
                  {statsCards.map(card => (
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
        </>
        )}

      </FormToolPage>
    </>
  )
}
