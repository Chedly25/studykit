/**
 * Export shortlist as Markdown/clipboard.
 */
import { useState } from 'react'
import { Download, Check, Copy } from 'lucide-react'

interface Props {
  onExport: () => string
}

export function ReviewExport({ onExport }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const markdown = onExport()
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const markdown = onExport()
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `article-review-shortlist-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copied!' : 'Copy Shortlist'}
      </button>
      <button
        onClick={handleDownload}
        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
      >
        <Download size={12} />
        Download .md
      </button>
    </div>
  )
}
