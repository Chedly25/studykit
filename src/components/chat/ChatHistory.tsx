import { useState, useEffect } from 'react'
import { MessageSquare, Trash2, Plus } from 'lucide-react'
import { getConversations, deleteConversation } from '../../ai/messageStore'
import type { Conversation } from '../../db/schema'

interface Props {
  examProfileId: string
  activeConversationId: string | null
  onSelect: (conversationId: string) => void
  onNew: () => void
}

export function ChatHistory({ examProfileId, activeConversationId, onSelect, onNew }: Props) {
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

  return (
    <div className="border-b border-[var(--border-card)] p-2">
      <button
        onClick={onNew}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors mb-1"
      >
        <Plus className="w-3.5 h-3.5" /> New Chat
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
