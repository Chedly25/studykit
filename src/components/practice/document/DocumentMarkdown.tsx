/**
 * Renders Markdown+LaTeX content for exam documents.
 * Uses ReactMarkdown + remarkMath + rehypeKatex — same stack as FicheViewer and ChatMessage.
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface DocumentMarkdownProps {
  content: string
  className?: string
}

export function DocumentMarkdown({ content, className }: DocumentMarkdownProps) {
  return (
    <div className={`
      prose prose-sm max-w-none
      prose-headings:text-[var(--text-heading)] prose-headings:font-semibold
      prose-p:text-[var(--text-body)] prose-p:leading-relaxed
      prose-strong:text-[var(--text-heading)]
      prose-em:text-[var(--text-body)]
      prose-li:text-[var(--text-body)]
      prose-blockquote:border-[var(--accent-text)] prose-blockquote:text-[var(--text-muted)]
      prose-code:text-[var(--accent-text)] prose-code:bg-[var(--accent-bg)] prose-code:px-1 prose-code:rounded prose-code:text-xs
      prose-hr:border-[var(--border-card)]
      ${className ?? ''}
    `}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
