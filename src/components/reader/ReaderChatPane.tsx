/**
 * Embedded chat pane for the document reader.
 * Two modes based on document category:
 * - Exam: focused exam companion (question by question, grading, hints)
 * - Course: concept companion (explain, generate cards, answer questions)
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { X, BookOpen, ClipboardCheck } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { useExamProfile } from '../../hooks/useExamProfile'
import { useKnowledgeGraph } from '../../hooks/useKnowledgeGraph'
import { useAgent } from '../../hooks/useAgent'
import { useAttachments } from '../../hooks/useAttachments'
import { ChatMessageBubble } from '../chat/ChatMessage'
import { CitationPopover, useCitationPopover } from '../chat/SourceCitation'
import { ChatInput, type ContextPill } from '../chat/ChatInput'
import SimilarExamsModal from './SimilarExamsModal'
import { Search as SearchIcon } from 'lucide-react'
import { ToolCallIndicator } from '../chat/ToolCallIndicator'
import { ChatContextProvider } from '../chat/ChatContext'
import { UpgradePrompt } from '../subscription/UpgradePrompt'
import type { Exercise } from '../../db/schema'

interface Props {
  documentId: string
  documentTitle: string
  documentCategory?: string
  selectionContext?: { text: string; pageNumber: number; documentTitle: string } | null
  onSelectionContextConsumed: () => void
  onClose: () => void
  /** Called when a citation with a known page number is clicked. */
  onJumpToPage?: (pageNumber: number) => void
}

const CONV_KEY = (docId: string) => `reader_conv_${docId}`

// ─── Mode-specific system prompts ──────

function buildExamCompanionPrompt(docTitle: string, exercises: Exercise[]): string {
  const exerciseList = exercises.map(ex =>
    `### Exercise ${ex.exerciseNumber} (Difficulty: ${ex.difficulty}/5)\n${ex.text}${ex.solutionText ? `\n**Solution:** ${ex.solutionText}` : ''}`
  ).join('\n\n')

  return `You are an exam companion. The student is working through "${docTitle}" question by question.

## Your role
- Help them work through the exam sequentially
- When they start: suggest beginning with Exercise 1 or ask which one they want to tackle
- For each question: let them attempt it first, then check their work
- Give hints when they're stuck — don't give the full answer immediately
- After they submit an answer: grade it honestly and directly
- If they give a nonsense answer, call it out bluntly
- When they finish a question, suggest the next one

## Rules
- STAY FOCUSED ON THIS EXAM. No flashcard suggestions, no study plans, no mastery coaching.
- Be direct and rigorous. You are a demanding professor, not a cheerleader.
- Use $...$ for inline math and $$...$$ for display math.
- When checking their work: compare against the solution and point out specific errors
- Respond in the student's language (match whatever they write in)
- Never use emojis

## Exam Content
${exerciseList}
`
}

function buildCourseCompanionPrompt(docTitle: string): string {
  return `You are a course companion for "${docTitle}". Help the student understand the material.

## Your role
- Explain concepts clearly when asked
- Answer questions about theorems, proofs, definitions from the document
- Use renderConceptCard tool for structured concept delivery when appropriate
- Use renderQuiz tool for knowledge checks when the student asks for exercises
- Use the document content as your primary source (available via semantic search)

## Rules
- Stay focused on this document's content
- Be clear and direct in explanations
- Use $...$ for inline math and $$...$$ for display math
- Respond in the student's language
- Reference specific sections from the document when explaining
- NEVER write exercises as plain text — always use renderQuiz tool
- Never use emojis
`
}

// ─── Component ──────

export function ReaderChatPane({ documentId, documentTitle, documentCategory, selectionContext, onSelectionContextConsumed, onClose, onJumpToPage }: Props) {
  const { getToken } = useAuth()
  const { activeProfile } = useExamProfile()
  const profileId = activeProfile?.id
  const { subjects, topics, dailyLogs } = useKnowledgeGraph(profileId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [contextPills, setContextPills] = useState<ContextPill[]>([])
  const restoredRef = useRef(false)
  const citationPopover = useCitationPopover(profileId, onJumpToPage)
  const [similarSourceChunkId, setSimilarSourceChunkId] = useState<string | null>(null)

  const isExam = documentCategory === 'exam'

  // Load exam exercises when document is an exam
  const examExercises = useLiveQuery(
    async () => {
      if (!isExam) return null
      const source = await db.examSources.where('documentId').equals(documentId).first()
      if (!source) return null
      const exercises = await db.exercises
        .where('examSourceId').equals(source.id)
        .toArray()
      return exercises
        .filter(e => !e.hidden)
        .sort((a, b) => a.exerciseNumber - b.exerciseNumber)
    },
    [documentId, isExam],
  )

  // Build mode-specific prompt
  const customPrompt = useMemo(() => {
    if (isExam && examExercises && examExercises.length > 0) {
      return buildExamCompanionPrompt(documentTitle, examExercises)
    }
    if (documentCategory === 'course') {
      return buildCourseCompanionPrompt(documentTitle)
    }
    return undefined
  }, [isExam, documentCategory, documentTitle, examExercises])

  // File attachments
  const { attachments, addFiles, removeAttachment, clearAttachments, isParsing, getRelevantChunks } = useAttachments()

  const agent = useAgent({
    profile: activeProfile,
    subjects,
    topics,
    dailyLogs,
    sourcesEnabled: true,
    customSystemPrompt: customPrompt,
  })

  const { messages, isLoading, currentToolCall, streamingText, error, quotaExceeded, conversationId, sendMessage, cancel, loadConversation } = agent

  // Cancel in-flight requests on unmount
  useEffect(() => {
    return () => { cancel() }
  }, [cancel])

  // Restore conversation for this document on mount
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const savedConvId = localStorage.getItem(CONV_KEY(documentId))
    if (savedConvId) {
      loadConversation(savedConvId).catch(() => {
        localStorage.removeItem(CONV_KEY(documentId))
      })
    }
  }, [documentId, loadConversation])

  // Persist conversation ID
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(CONV_KEY(documentId), conversationId)
    }
  }, [conversationId, documentId])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText])

  // Convert selection context to a context pill
  useEffect(() => {
    if (selectionContext) {
      const truncTitle = selectionContext.documentTitle.length > 20
        ? selectionContext.documentTitle.slice(0, 17) + '...'
        : selectionContext.documentTitle
      const pill: ContextPill = {
        id: crypto.randomUUID(),
        label: `${truncTitle} · p.${selectionContext.pageNumber}`,
        content: `From page ${selectionContext.pageNumber} of "${selectionContext.documentTitle}":\n\n"${selectionContext.text}"`,
      }
      setContextPills([pill])
      onSelectionContextConsumed()
    }
  }, [selectionContext, onSelectionContextConsumed])

  const handleSend = useCallback(async (message: string) => {
    let fullMessage = message

    // Context pills (PDF text selection)
    if (contextPills.length > 0) {
      const contextBlock = contextPills.map(p =>
        `<<CTX:${p.label}>>${p.content}<</CTX>>`
      ).join('\n')
      fullMessage = `${contextBlock}\n${message}`
      setContextPills([])
    }

    // File attachments
    let attachmentContext: { chunks: Array<{ content: string; documentTitle: string; chunkIndex: number }> } | undefined
    if (attachments.length > 0) {
      const chunks = getRelevantChunks(message, 5)
      if (chunks.length > 0) {
        attachmentContext = { chunks }
      }
      clearAttachments()
    }

    await sendMessage(fullMessage, attachmentContext)
  }, [sendMessage, contextPills, attachments, getRelevantChunks, clearAttachments])

  const handleRemoveContextPill = useCallback((id: string) => {
    setContextPills(prev => prev.filter(p => p.id !== id))
  }, [])

  const handleFindSimilarExams = useCallback(async () => {
    // Use the first chunk of this document as the source for similarity
    const firstChunk = await db.documentChunks
      .where('documentId').equals(documentId)
      .first()
    if (firstChunk) {
      setSimilarSourceChunkId(firstChunk.id)
    }
  }, [documentId])

  // Mode icon + label
  const ModeIcon = isExam ? ClipboardCheck : BookOpen
  const modeLabel = isExam ? 'Exam Companion' : documentCategory === 'course' ? 'Course Companion' : 'AI Assistant'

  return (
    <div className="flex flex-col h-full border-l border-[var(--border-card)] bg-[var(--bg-card)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-card)]">
        <div className="flex items-center gap-2">
          <ModeIcon className="w-4 h-4 text-[var(--accent-text)]" />
          <span className="text-sm font-medium text-[var(--text-heading)]">{modeLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {isExam && (
            <button
              onClick={handleFindSimilarExams}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
              title="Trouver des sujets similaires dans tes annales"
            >
              <SearchIcon className="w-3 h-3" />
              Similaires
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ChatContextProvider value={{ examProfileId: profileId, getToken }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <ModeIcon className="w-8 h-8 text-[var(--accent-text)] mx-auto mb-3 opacity-30" />
              {isExam ? (
                examExercises === undefined ? (
                  <p className="text-sm text-[var(--text-muted)]">Loading exam data...</p>
                ) : examExercises === null ? (
                  <p className="text-sm text-[var(--text-muted)]">Processing exam exercises...</p>
                ) : examExercises.length > 0 ? (
                  <>
                    <p className="text-sm text-[var(--text-muted)]">Ready to work through {examExercises.length} exercises.</p>
                    <p className="text-xs text-[var(--text-faint)] mt-1">Say "let's start" or pick a specific exercise.</p>
                  </>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">Ask about this exam document.</p>
                )
              ) : (
                <>
                  <p className="text-sm text-[var(--text-muted)]">Select text in the PDF and click "Ask AI" to get help.</p>
                  <p className="text-xs text-[var(--text-faint)] mt-1">Or type a question about this document.</p>
                </>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessageBubble
              key={msg.id}
              message={msg}
              examProfileId={profileId}
              onCitationClick={citationPopover.showCitation}
            />
          ))}

          {streamingText && (
            <ChatMessageBubble
              message={{ id: crypto.randomUUID(), role: 'assistant', content: streamingText }}
              isStreaming
            />
          )}

          {currentToolCall && <ToolCallIndicator toolName={currentToolCall} />}

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">
              {error}
            </div>
          )}

          {quotaExceeded && <UpgradePrompt />}
        </div>
      </ChatContextProvider>

      {/* Input */}
      <div className="p-3 border-t border-[var(--border-card)]">
        <ChatInput
          onSend={handleSend}
          disabled={isLoading || !activeProfile || quotaExceeded}
          placeholder={isExam ? 'Your answer or question...' : 'Ask about this document...'}
          contextPills={contextPills}
          onRemoveContextPill={handleRemoveContextPill}
          attachments={attachments}
          onAddFiles={addFiles}
          onRemoveAttachment={removeAttachment}
          isParsing={isParsing}
        />
      </div>

      {citationPopover.activeCitation && (
        <CitationPopover
          citation={citationPopover.activeCitation}
          content={citationPopover.citationContent}
          isLoading={citationPopover.isLoadingCitation}
          onClose={citationPopover.closeCitation}
        />
      )}

      {similarSourceChunkId && profileId && (
        <SimilarExamsModal
          sourceChunkId={similarSourceChunkId}
          examProfileId={profileId}
          onClose={() => setSimilarSourceChunkId(null)}
        />
      )}
    </div>
  )
}
