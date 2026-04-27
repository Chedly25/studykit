import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Scale, Send, Paperclip, X, FileText, Menu, NotebookPen } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLegalChat } from '../hooks/useLegalChat'
import { useExamProfile } from '../hooks/useExamProfile'
import { db } from '../db'
import { LegalMessageBubble } from '../components/legal/LegalMessageBubble'
import { LegalArticlesPanel } from '../components/legal/LegalArticlesPanel'
import { LegalConversationList } from '../components/legal/LegalConversationList'
import { LegalPageTabs } from '../components/legal/LegalPageTabs'

const SUGGESTIONS = [
  'Quelles sont les conditions de validité d\'un contrat ?',
  'Quelles sont les peines encourues pour un vol aggravé ?',
  'Un employeur peut-il licencier sans cause réelle et sérieuse ?',
  'Quels sont les droits du locataire en cas de logement insalubre ?',
]

interface Attachment {
  name: string
  content: string
  size: number
}

export default function LegalChat() {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    messages,
    conversations,
    conversationId,
    isLoading,
    streamingText,
    currentToolCall,
    lastArticles,
    lastCoursChunks,
    sendMessage,
    cancel,
    selectConversation,
    newConversation,
    removeConversation,
    renameConversation,
  } = useLegalChat()

  const { activeProfile } = useExamProfile()
  const documentCount = useLiveQuery(
    async () => (activeProfile?.id ? db.documents.where('examProfileId').equals(activeProfile.id).count() : 0),
    [activeProfile?.id],
  ) ?? 0
  const [coursBannerDismissed, setCoursBannerDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('legal-chat:cours-banner-dismissed') === '1',
  )
  const dismissCoursBanner = () => {
    localStorage.setItem('legal-chat:cours-banner-dismissed', '1')
    setCoursBannerDismissed(true)
  }
  const showCoursBanner = !coursBannerDismissed && documentCount === 0 && activeProfile?.id

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      if (file.size > 1024 * 1024 * 2) { // 2MB limit
        alert(`${file.name} est trop volumineux (max 2 Mo)`)
        continue
      }
      const content = await file.text()
      setAttachments(prev => [...prev, { name: file.name, content, size: file.size }])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (i: number) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && attachments.length === 0) || isLoading) return

    // Build message with attachments
    let fullMessage = input.trim()
    if (attachments.length > 0) {
      const ctx = attachments.map(a => `--- Document joint : ${a.name} ---\n${a.content.slice(0, 10000)}`).join('\n\n')
      fullMessage = `${fullMessage}\n\n## Contexte (documents fournis par l'utilisateur)\n\n${ctx}`
    }

    sendMessage(fullMessage)
    setInput('')
    setAttachments([])
  }

  const handleSuggestion = (text: string) => {
    sendMessage(text)
  }

  // Extract displayable messages — preserve assistant text between tool calls
  const displayMessages: Array<{ role: 'user' | 'assistant'; text: string }> = []
  for (const m of messages) {
    if (m.role === 'user') {
      const text = typeof m.content === 'string'
        ? m.content
        : (m.content as Array<{ type: string; text?: string }>).filter(b => b.type === 'text').map(b => b.text ?? '').join('')
      // Hide the raw context dump from display
      const userVisible = text.split('\n\n## Contexte (documents fournis par l\'utilisateur)')[0]
      if (userVisible.trim()) displayMessages.push({ role: 'user', text: userVisible })
    } else if (m.role === 'assistant') {
      const text = typeof m.content === 'string'
        ? m.content
        : (m.content as Array<{ type: string; text?: string }>).filter(b => b.type === 'text').map(b => b.text ?? '').join('')
      if (text.trim()) displayMessages.push({ role: 'assistant', text })
    }
  }

  const hasMessages = displayMessages.length > 0 || streamingText

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto">
      <LegalPageTabs />
      <div className="flex flex-1 min-h-0">
      {/* History sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border-card)] shrink-0">
        <LegalConversationList
          conversations={conversations}
          activeId={conversationId}
          onSelect={selectConversation}
          onNew={newConversation}
          onDelete={removeConversation}
          onRename={renameConversation}
        />
      </aside>

      {/* History drawer (mobile) */}
      {historyOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setHistoryOpen(false)} />
          <div className="relative w-72 bg-[var(--bg-main)] h-full flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-[var(--border-card)]">
              <span className="text-sm font-semibold">Historique</span>
              <button onClick={() => setHistoryOpen(false)} className="p-1.5 rounded hover:bg-[var(--bg-hover)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <LegalConversationList
                conversations={conversations}
                activeId={conversationId}
                onSelect={(id) => { selectConversation(id); setHistoryOpen(false) }}
                onNew={() => { newConversation(); setHistoryOpen(false) }}
                onDelete={removeConversation}
                onRename={renameConversation}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main chat column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-card)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHistoryOpen(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
              title="Historique"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Scale className="w-5 h-5 text-[var(--accent-text)]" />
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-heading)]">Recherche juridique</h1>
              <p className="text-xs text-[var(--text-muted)]">Codes + jurisprudence + Constitution + CEDH + RGPD</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center h-full gap-8">
              <div className="text-center">
                <Scale className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-40" />
                <h2 className="text-xl font-semibold text-[var(--text-heading)] mb-2">Posez votre question de droit</h2>
                <p className="text-sm text-[var(--text-muted)] max-w-md">
                  Recherche sémantique dans 60 000+ sources : 15 codes français, jurisprudence de la Cour de cassation, bloc de constitutionnalité, CEDH, RGPD.
                </p>
              </div>
              {showCoursBanner && (
                <div className="w-full max-w-lg flex items-start gap-3 px-4 py-3 rounded-xl border border-[var(--border-card)] bg-[var(--accent-bg)]/30">
                  <NotebookPen className="w-4 h-4 mt-0.5 text-[var(--accent-text)] shrink-0" />
                  <div className="flex-1 text-sm text-[var(--text-secondary)]">
                    Téléverse tes cours dans <Link to="/sources" className="font-semibold text-[var(--accent-text)] hover:underline">Sources</Link> pour qu'Oracle s'appuie aussi sur tes notes.
                  </div>
                  <button
                    type="button"
                    onClick={dismissCoursBanner}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
                    aria-label="Fermer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(s)}
                    className="text-left text-sm px-4 py-3 rounded-xl border border-[var(--border-card)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {displayMessages.map((m, i) => (
                <LegalMessageBubble key={i} role={m.role} content={m.text} />
              ))}
              {streamingText && (
                <LegalMessageBubble role="assistant" content={streamingText} />
              )}
              {isLoading && (
                <LoadingIndicator toolCall={currentToolCall} hasStreamingText={!!streamingText} />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2">
          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)] text-sm">
                  <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-secondary)] max-w-[180px] truncate">{att.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{(att.size / 1024).toFixed(0)}ko</span>
                  <button type="button" onClick={() => removeAttachment(i)} className="text-[var(--text-muted)] hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 p-2 rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] focus-within:border-[var(--accent-text)] transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] shrink-0"
              title="Joindre un document (contrat, courrier, etc.)"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder="Ex : Quelles sont les conditions de validité d'un contrat ?"
              rows={1}
              className="flex-1 bg-transparent px-2 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none max-h-40"
              disabled={isLoading}
            />
            {isLoading ? (
              <button type="button" onClick={cancel} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 shrink-0">
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && attachments.length === 0}
                className="p-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] disabled:opacity-30 hover:opacity-90 transition-opacity shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2 px-1">
            Vous pouvez joindre des documents (contrat, courrier) pour contextualiser votre question.
          </p>
        </form>
      </div>

      {/* Articles sidebar (desktop) */}
      {(lastArticles.length > 0 || lastCoursChunks.length > 0) && (
        <aside className="hidden lg:block w-96 border-l border-[var(--border-card)] overflow-y-auto p-4">
          <LegalArticlesPanel articles={lastArticles} coursChunks={lastCoursChunks} />
        </aside>
      )}
      </div>
    </div>
  )
}

function LoadingIndicator({ toolCall, hasStreamingText }: { toolCall: string | null; hasStreamingText: boolean }) {
  // Don't show indicator if we're streaming text (user already sees response)
  if (hasStreamingText) return null

  const label = toolCall === 'searchLegalCodes'
    ? 'Recherche dans les codes et la jurisprudence'
    : toolCall === 'searchUserCours'
      ? 'Recherche dans tes cours'
      : toolCall === 'createFlashcardDeck'
        ? 'Création des fiches'
        : 'Analyse de la question'

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-[var(--accent-text)] animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full bg-[var(--accent-text)] animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 rounded-full bg-[var(--accent-text)] animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm text-[var(--text-muted)]">{label}...</span>
    </div>
  )
}
