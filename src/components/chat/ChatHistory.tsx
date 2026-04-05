import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Trash2, Plus, Search } from 'lucide-react'
import { getConversations, deleteConversation } from '../../ai/messageStore'
import { db } from '../../db'
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

function getSnippet(content: string, query: string, maxLen = 80): string {
  const lower = content.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return content.slice(0, maxLen)
  const start = Math.max(0, idx - 30)
  const end = Math.min(content.length, idx + query.length + 50)
  return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '')
}

export function ChatHistory({ examProfileId, activeConversationId, onSelect, onNew, compact = false }: Props) {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [messageMatches, setMessageMatches] = useState<Map<string, string>>(new Map())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getConversations(examProfileId).then(setConversations)
  }, [examProfileId, activeConversationId])

  // Debounced full-text message search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (searchQuery.length < 3) {
      setMessageMatches(new Map())
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const query = searchQuery.toLowerCase()
        const matches = await db.chatMessages
          .filter(m => m.role !== 'system' && m.content.toLowerCase().includes(query))
          .limit(50)
          .toArray()
        const map = new Map<string, string>()
        for (const m of matches) {
          if (!map.has(m.conversationId)) {
            map.set(m.conversationId, getSnippet(m.content, searchQuery))
          }
        }
        setMessageMatches(map)
      } catch {
        setMessageMatches(new Map())
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteConversation(id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (id === activeConversationId) onNew()
  }

  // Filter by title + merge message matches
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations
    const query = searchQuery.toLowerCase()
    const titleMatches = conversations.filter(c => c.title.toLowerCase().includes(query))
    // Add conversations found via message search that aren't already in title matches
    const titleIds = new Set(titleMatches.map(c => c.id))
    const messageOnly = conversations.filter(c => !titleIds.has(c.id) && messageMatches.has(c.id))
    return [...titleMatches, ...messageOnly]
  }, [conversations, searchQuery, messageMatches])

  const groups = useMemo(() => groupByDate(filteredConversations, t), [filteredConversations, t])
  const hasResults = filteredConversations.length > 0

  // ─── Compact mode (ChatPanel sidebar) ─────────────────────────

  if (compact) {
    const compactFiltered = searchQuery
      ? conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : conversations

    return (
      <div className="border-b border-[var(--border-card)] p-2">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors mb-1"
        >
          <Plus className="w-3.5 h-3.5" /> {t('ai.newConversation')}
        </button>
        <div className="px-1 pb-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-faint)]" />
            <input
              type="text"
              placeholder={t('ai.searchConversations')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-[10px] bg-[var(--bg-input)] border border-[var(--border-card)] rounded-md pl-6 pr-2 py-1 text-[var(--text-body)]"
            />
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {compactFiltered.length === 0 && searchQuery && (
            <p className="text-[10px] text-[var(--text-muted)] text-center py-2">{t('common.noResults')}</p>
          )}
          {compactFiltered.map(c => (
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

  // ─── Full mode (Chat.tsx sidebar) ─────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 space-y-2">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[var(--accent-text)] border border-dashed border-[var(--border-card)] hover:bg-[var(--accent-bg)] transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('ai.newConversation')}
        </button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder={t('ai.searchConversations')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg pl-8 pr-3 py-1.5 text-[var(--text-body)]"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-3">
        {!hasResults && searchQuery && (
          <p className="text-xs text-[var(--text-muted)] text-center py-4">{t('common.noResults')}</p>
        )}
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
                  className={`w-full flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-sm transition-colors group ${
                    c.id === activeConversationId
                      ? 'bg-[var(--accent-bg)] text-[var(--accent-text)] border-l-2 border-l-[var(--accent-text)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-input)]'
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate flex-1 text-left">{c.title}</span>
                    <button
                      onClick={(e) => handleDelete(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {searchQuery && messageMatches.has(c.id) && (
                    <span className="text-[10px] text-[var(--text-faint)] truncate block pl-5.5 ml-[22px]">
                      {messageMatches.get(c.id)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
