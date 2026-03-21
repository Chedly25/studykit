import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Paperclip, FileText, X } from 'lucide-react'
import { AttachmentChip } from './AttachmentChip'
import type { ChatAttachment } from '../../hooks/useAttachments'

const MAX_LENGTH = 4000

export interface ContextPill {
  id: string
  label: string
  content: string
}

interface Props {
  onSend: (message: string, attachments?: ChatAttachment[]) => void
  disabled?: boolean
  placeholder?: string
  attachments?: ChatAttachment[]
  onAddFiles?: (files: File[]) => void
  onRemoveAttachment?: (index: number) => void
  isParsing?: boolean
  initialValue?: string
  onInitialValueConsumed?: () => void
  contextPills?: ContextPill[]
  onRemoveContextPill?: (id: string) => void
}

export function ChatInput({ onSend, disabled, placeholder, attachments, onAddFiles, onRemoveAttachment, isParsing, initialValue, onInitialValueConsumed, contextPills, onRemoveContextPill }: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Accept pre-filled text from parent
  useEffect(() => {
    if (initialValue !== undefined && initialValue !== '') {
      setText(initialValue)
      onInitialValueConsumed?.()
      setTimeout(() => ref.current?.focus(), 50)
    }
  }, [initialValue, onInitialValueConsumed])

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + 'px'
    }
  }, [text])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled || isParsing || trimmed.length > MAX_LENGTH) return
    onSend(trimmed, attachments && attachments.length > 0 ? attachments : undefined)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !onAddFiles) return
    onAddFiles(Array.from(files))
    e.target.value = ''
  }

  const hasAttachments = attachments && attachments.length > 0

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-card)] chat-input-shadow">
      {/* Attachment chips */}
      {hasAttachments && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {attachments.map((att, i) => (
            <AttachmentChip
              key={i}
              name={att.name}
              status={att.status}
              onRemove={() => onRemoveAttachment?.(i)}
            />
          ))}
        </div>
      )}

      {/* Context pills (e.g. PDF text selection) */}
      {contextPills && contextPills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {contextPills.map(pill => (
            <span
              key={pill.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20"
            >
              <FileText className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[180px]">{pill.label}</span>
              <button
                onClick={() => onRemoveContextPill?.(pill.id)}
                className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-input)] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* Paperclip button */}
        {onAddFiles && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
              className="p-2.5 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-input)] hover:text-[var(--accent-text)] transition-colors disabled:opacity-40"
              title={t('ai.attachFile')}
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </>
        )}

        <textarea
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t('ai.typeMessage')}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent border-none focus:outline-none focus:ring-0 text-base text-[var(--text-body)] placeholder:text-[var(--text-faint)] disabled:opacity-50 py-2 px-1"
        />
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          {text.length > MAX_LENGTH * 0.8 && (
            <span className={`text-xs ${text.length > MAX_LENGTH ? 'text-red-400' : 'text-[var(--text-faint)]'}`}>
              {text.length}/{MAX_LENGTH}
            </span>
          )}
          <button
            onClick={handleSend}
            disabled={disabled || isParsing || !text.trim() || text.trim().length > MAX_LENGTH}
            className="p-2.5 rounded-xl bg-[var(--accent-text)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
