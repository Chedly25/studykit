import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Trash2, Plus } from 'lucide-react'
import { getConversations, deleteConversation } from '../../ai/messageStore'
import type { Conversation } from '../../db/schema'

interface Props {
  examProfileId: string
  activeConversationId: string | null
  onSelect: (conversationId: string) => void
  onNew: () => void
  compact?: boolean
}

function groupByDate(conversations: Conversation[], t: (key: string) => string) {
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const weekAgo = Date.now() - 7 * 86400000

  const groups: { label: string; items: Conversation[] }[] = [
    { label: t('ai.today'), items: [] },
    { label: t('ai.yesterday'), items: [] },
    { label: t('ai.previousWeek'), items: [] },
    { label: t('ai.older'), items: [] },
  ]

  for (const c of conversations) {
    const d = new Date(c.createdAt)
    const ds = d.toDateString()
    if (ds === today) groups[0].items.push(c)
    else if (ds === yesterday) groups[1].items.push(c)
    else if (d.getTime() > weekAgo) groups[2].items.push(c)
    else groups[3].items.push(c)
  }

  return groups.filter(g => g.items.length > 0)
}

export function ChatHistory({ examProfileId, activeConversationId, onSelect, onNew, compact = false }: Props) {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<Conversation[]>([])

  useEffect(() => {
    getConversations(examProfileId).then(setConversations)
  }, [examProfileId, activeConversationId])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteConversation(id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (id === activeConversationId) onNew()
  }

  const groups = useMemo(() => groupByDate(conversations, t), [conversations, t])

  // Compact mode (ChatPanel sidebar)
  if (compact) {
    return (
      <div className="border-b border-[var(--border-card)] p-2">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors mb-1"
        >
          <Plus className="w-3.5 h-3.5" /> {t('ai.newConversation')}
        </button>
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors group ${
                c.id === activeConversationId
                  ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-input)]'
              }`}
            >
              <MessageSquare className="w-3 h-3 flex-shrink-0" />
              <span className="truncate flex-1 text-left">{c.title}</span>
              <button
                onClick={(e) => handleDelete(c.id, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Full mode (Chat.tsx sidebar)
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[var(--accent-text)] border border-dashed border-[var(--border-card)] hover:bg-[var(--accent-bg)] transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('ai.newConversation')}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-3">
        {groups.map(group => (
          <div key={group.label}>
            <div className="text-xs text-[var(--text-faint)] uppercase tracking-wider px-3 py-1.5">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(c => (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors group ${
                    c.id === activeConversationId
                      ? 'bg-[var(--accent-bg)] text-[var(--accent-text)] border-l-2 border-l-[var(--accent-text)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-input)]'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate flex-1 text-left">{c.title}</span>
                  <button
                    onClick={(e) => handleDelete(c.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
