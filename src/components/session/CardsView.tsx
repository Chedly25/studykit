import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Check, HelpCircle, Plus, Pencil, Trash2, X, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { useConceptCards } from '../../hooks/useConceptCards'
import { db } from '../../db'
import { FicheViewer } from './FicheViewer'
import type { ConceptCard } from '../../db/schema'

interface CardsViewProps {
  examProfileId: string
  topicId: string
  onQuizMe?: (topic: string) => void
}

// ─── Card Form (create + edit) ──────

interface CardFormProps {
  initialTitle?: string
  initialKeyPoints?: string[]
  initialExample?: string
  onSave: (data: { title: string; keyPoints: string[]; example: string }) => Promise<void>
  onCancel: () => void
}

function CardForm({ initialTitle, initialKeyPoints, initialExample, onSave, onCancel }: CardFormProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(initialTitle ?? '')
  const [keyPoints, setKeyPoints] = useState<string[]>(initialKeyPoints?.length ? initialKeyPoints : [''])
  const [example, setExample] = useState(initialExample ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const canSave = title.trim() !== '' && keyPoints.some(p => p.trim() !== '')

  const handleSave = async () => {
    if (!canSave || isSaving) return
    setIsSaving(true)
    try {
      await onSave({ title: title.trim(), keyPoints: keyPoints.filter(p => p.trim()), example: example.trim() })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="h-1 bg-[var(--accent-text)]" />
      <div className="p-4 space-y-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('cards.titlePlaceholder')}
          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
          autoFocus
        />

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">{t('cards.keyPoints')}</label>
          <div className="space-y-1.5">
            {keyPoints.map((point, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[var(--accent-text)] shrink-0" />
                <input
                  value={point}
                  onChange={e => {
                    const next = [...keyPoints]
                    next[i] = e.target.value
                    setKeyPoints(next)
                  }}
                  placeholder={t('cards.pointPlaceholder', { n: i + 1 })}
                  className="flex-1 px-2 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--border-card)] text-xs text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)]"
                />
                {keyPoints.length > 1 && (
                  <button
                    onClick={() => setKeyPoints(keyPoints.filter((_, j) => j !== i))}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setKeyPoints([...keyPoints, ''])}
            className="text-[10px] text-[var(--accent-text)] hover:underline mt-1.5"
          >
            {t('cards.addPoint')}
          </button>
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1 block">{t('cards.exampleLabel')}</label>
          <textarea
            value={example}
            onChange={e => setExample(e.target.value)}
            placeholder={t('cards.examplePlaceholder')}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-card)] text-xs text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-text)] resize-none"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-text)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card Item ──────

function CardItem({ card, onQuizMe, onEdit, onDelete, onViewFiche }: {
  card: ConceptCard
  onQuizMe?: (t: string) => void
  onEdit: () => void
  onDelete: () => void
  onViewFiche: () => void
}) {
  const { t } = useTranslation()
  const mastered = card.mastery >= 0.8
  let keyPoints: string[] = []
  try { keyPoints = JSON.parse(card.keyPoints) } catch { /* empty */ }

  // Extract first section from rich content for preview
  const firstSection = useMemo(() => {
    if (!card.content) return null
    const parts = card.content.split(/^## /m).filter(p => p.trim())
    if (parts.length === 0) return null
    const first = parts[0]
    const newlineIdx = first.indexOf('\n')
    if (newlineIdx === -1) return null
    return { heading: first.slice(0, newlineIdx).trim(), body: first.slice(newlineIdx + 1).trim() }
  }, [card.content])

  return (
    <div className={`glass-card overflow-hidden transition-all ${mastered ? 'ring-1 ring-green-500/20' : ''}`}>
      <div className="h-1.5 bg-[var(--accent-text)]" />
      <div className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-[var(--accent-text)] mt-0.5 flex-shrink-0" />
          <h4 className="text-sm font-semibold text-[var(--text-heading)] flex-1">{card.title}</h4>
          <div className="flex items-center gap-0.5 shrink-0">
            {mastered && <Check className="w-4 h-4 text-green-500" />}
            <button onClick={onEdit} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors" title="Edit">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={onDelete} className="p-1 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Delete">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Rich content preview (first section) */}
        {firstSection ? (
          <div className="rounded-lg border-l-4 border-blue-400 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-500/5 p-2.5 mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">{firstSection.heading}</p>
            <div className="text-xs text-[var(--text-body)] line-clamp-3 prose-sm max-w-none prose-p:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {firstSection.body.slice(0, 300)}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          /* Legacy bullet point preview */
          <ul className="space-y-1 mb-3">
            {keyPoints.slice(0, 4).map((p, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-body)]">
                <span className="w-1 h-1 rounded-full bg-[var(--accent-text)] mt-1.5 flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        )}

        {!firstSection && card.example && (
          <div className="rounded-lg border-l-4 border-emerald-400 bg-emerald-50/60 dark:bg-emerald-500/5 px-2.5 py-1.5 mb-3">
            <p className="text-[11px] text-[var(--text-body)] line-clamp-2">{card.example}</p>
          </div>
        )}

        {card.sourceReference && (
          <p className="text-[10px] text-[var(--text-faint)] mb-2 italic">{card.sourceReference}</p>
        )}

        <div className="flex items-center gap-1.5">
          <button
            onClick={onViewFiche}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors"
          >
            <FileText className="w-3 h-3" /> {t('cards.viewFiche')}
          </button>
          {onQuizMe && (
            <button
              onClick={() => onQuizMe(card.title)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-[var(--bg-input)] text-[var(--text-muted)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors"
            >
              <HelpCircle className="w-3 h-3" /> {t('cards.quizMe')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Cards View ──────

export function CardsView({ examProfileId, topicId, onQuizMe }: CardsViewProps) {
  const { t } = useTranslation()
  const { cards } = useConceptCards(examProfileId, topicId)
  const [isCreating, setIsCreating] = useState(false)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [ficheCardIndex, setFicheCardIndex] = useState<number | null>(null)

  const grouped = useMemo(() => {
    const newCards = cards.filter(c => c.mastery < 0.3)
    const learning = cards.filter(c => c.mastery >= 0.3 && c.mastery < 0.8)
    const mastered = cards.filter(c => c.mastery >= 0.8)
    return { newCards, learning, mastered }
  }, [cards])

  const handleCreate = async (data: { title: string; keyPoints: string[]; example: string }) => {
    const now = new Date().toISOString()
    await db.conceptCards.put({
      id: crypto.randomUUID(),
      examProfileId,
      topicId,
      title: data.title,
      keyPoints: JSON.stringify(data.keyPoints),
      example: data.example,
      sourceChunkIds: '[]',
      sourceReference: '',
      relatedCardIds: '[]',
      mastery: 0,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReviewDate: new Date().toISOString().slice(0, 10),
      createdAt: now,
      updatedAt: now,
    })
    setIsCreating(false)
  }

  const handleUpdate = async (cardId: string, data: { title: string; keyPoints: string[]; example: string }) => {
    await db.conceptCards.update(cardId, {
      title: data.title,
      keyPoints: JSON.stringify(data.keyPoints),
      example: data.example,
      updatedAt: new Date().toISOString(),
    })
    setEditingCardId(null)
  }

  const handleDelete = async (cardId: string) => {
    await db.conceptCards.delete(cardId)
    if (editingCardId === cardId) setEditingCardId(null)
  }

  const renderCard = (card: ConceptCard) => {
    if (editingCardId === card.id) {
      let keyPoints: string[] = []
      try { keyPoints = JSON.parse(card.keyPoints) } catch { /* empty */ }
      return (
        <CardForm
          key={card.id}
          initialTitle={card.title}
          initialKeyPoints={keyPoints}
          initialExample={card.example}
          onSave={(data) => handleUpdate(card.id, data)}
          onCancel={() => setEditingCardId(null)}
        />
      )
    }
    return (
      <CardItem
        key={card.id}
        card={card}
        onQuizMe={onQuizMe}
        onEdit={() => setEditingCardId(card.id)}
        onDelete={() => handleDelete(card.id)}
        onViewFiche={() => setFicheCardIndex(cards.indexOf(card))}
      />
    )
  }

  const renderGroup = (title: string, items: ConceptCard[], color: string) => {
    if (items.length === 0) return null
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{title} ({items.length})</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(renderCard)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-[960px] mx-auto">
        {/* Header with New card button */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">
            {t('cards.conceptCards')}{cards.length > 0 ? ` (${cards.length})` : ''}
          </h3>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-text)] text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> {t('cards.newCard')}
            </button>
          )}
        </div>

        {/* Create form */}
        {isCreating && (
          <div className="mb-4">
            <CardForm onSave={handleCreate} onCancel={() => setIsCreating(false)} />
          </div>
        )}

        {/* Card groups */}
        {cards.length > 0 ? (
          <>
            {renderGroup(t('cards.groupNew'), grouped.newCards, 'bg-red-500')}
            {renderGroup(t('cards.groupLearning'), grouped.learning, 'bg-yellow-500')}
            {renderGroup(t('cards.groupMastered'), grouped.mastered, 'bg-green-500')}
          </>
        ) : !isCreating ? (
          <div className="text-center py-12">
            <BookOpen className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">{t('cards.noCards')}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{t('cards.noCardsHint')}</p>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--accent-text)] text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> {t('cards.createFirst')}
            </button>
          </div>
        ) : null}

        {/* Fiche Viewer Modal */}
        {ficheCardIndex !== null && cards[ficheCardIndex] && (
          <FicheViewer
            card={cards[ficheCardIndex]}
            onClose={() => setFicheCardIndex(null)}
            onPrev={() => setFicheCardIndex(i => i !== null && i > 0 ? i - 1 : i)}
            onNext={() => setFicheCardIndex(i => i !== null && i < cards.length - 1 ? i + 1 : i)}
            hasPrev={ficheCardIndex > 0}
            hasNext={ficheCardIndex < cards.length - 1}
            onQuizMe={onQuizMe}
          />
        )}
      </div>
    </div>
  )
}
