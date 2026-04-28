import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import type { Annotation, AnnotationType } from '../../db/schema'

interface Props {
  chunkId: string
  annotations: Annotation[]
  onAdd: (chunkId: string, type: AnnotationType, content: string) => void
  onDelete: (id: string) => void
}

const typeColors: Record<AnnotationType, string> = {
  'key-finding': 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]',
  'methodology': 'bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info-border)]',
  'relates-to-my-work': 'bg-[var(--color-tag-flashcard-bg)] text-[var(--color-tag-flashcard)] border-[var(--color-tag-flashcard)]',
  'question': 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
  'note': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
}

const ANNOTATION_TYPES: AnnotationType[] = ['key-finding', 'methodology', 'relates-to-my-work', 'question', 'note']

export function AnnotationLayer({ chunkId, annotations, onAdd, onDelete }: Props) {
  const { t } = useTranslation()
  const [showAdd, setShowAdd] = useState(false)
  const [newType, setNewType] = useState<AnnotationType>('note')
  const [newContent, setNewContent] = useState('')

  const handleAdd = () => {
    if (!newContent.trim()) return
    onAdd(chunkId, newType, newContent.trim())
    setNewContent('')
    setShowAdd(false)
  }

  if (annotations.length === 0 && !showAdd) {
    return (
      <button
        onClick={() => setShowAdd(true)}
        className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] py-1"
      >
        <Plus className="w-3 h-3" /> {t('research.addAnnotation')}
      </button>
    )
  }

  return (
    <div className="space-y-1.5 mt-2">
      {annotations.map(ann => (
        <div key={ann.id} className={`flex items-start gap-2 px-2 py-1.5 rounded border text-xs ${typeColors[ann.type]}`}>
          <span className="font-medium whitespace-nowrap">
            {t(`research.annotationType.${ann.type}`)}
          </span>
          <span className="flex-1">{ann.content}</span>
          <button onClick={() => onDelete(ann.id)} className="opacity-50 hover:opacity-100 flex-shrink-0">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}

      {showAdd ? (
        <div className="space-y-2 p-2 rounded-lg bg-[var(--bg-input)]">
          <select
            value={newType}
            onChange={e => setNewType(e.target.value as AnnotationType)}
            className="select-field w-full text-xs"
          >
            {ANNOTATION_TYPES.map(type => (
              <option key={type} value={type}>
                {t(`research.annotationType.${type}`)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Your annotation..."
            className="input-field w-full text-xs"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="text-xs text-[var(--text-muted)]">{t('common.cancel')}</button>
            <button onClick={handleAdd} className="text-xs text-[var(--accent-text)]">{t('common.save')}</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)]"
        >
          <Plus className="w-3 h-3" /> {t('research.addAnnotation')}
        </button>
      )}
    </div>
  )
}
