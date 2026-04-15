import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  role: 'user' | 'assistant'
  content: string
}

export function LegalMessageBubble({ role, content }: Props) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-md bg-[var(--accent-bg)] text-[var(--accent-text)]">
          <p className="text-sm">{content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] px-4 py-3 rounded-2xl rounded-bl-md bg-[var(--bg-card)] border border-[var(--border-card)]">
        <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-primary)] legal-response">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
