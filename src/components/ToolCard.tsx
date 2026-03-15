import { Link } from 'react-router-dom'
import type { Tool } from '../lib/tools'

interface ToolCardProps {
  tool: Tool
}

export function ToolCard({ tool }: ToolCardProps) {
  const Icon = tool.icon

  return (
    <Link
      to={`/${tool.slug}`}
      className="glass-card glass-card-hover p-5 flex flex-col items-start gap-3 group"
    >
      <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center text-[var(--accent-text)] group-hover:opacity-80 transition-colors">
        <Icon size={20} />
      </div>
      <div>
        <h3 className="font-[family-name:var(--font-display)] font-semibold text-[var(--text-heading)] group-hover:text-[var(--accent-text)] transition-colors">
          {tool.name}
        </h3>
        <p className="text-sm text-[var(--text-muted)] mt-1">{tool.description}</p>
      </div>
    </Link>
  )
}
