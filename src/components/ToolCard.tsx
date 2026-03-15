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
      <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-400 group-hover:bg-primary-500/20 transition-colors">
        <Icon size={20} />
      </div>
      <div>
        <h3 className="font-[family-name:var(--font-display)] font-semibold text-surface-100 group-hover:text-primary-400 transition-colors">
          {tool.name}
        </h3>
        <p className="text-sm text-surface-400 mt-1">{tool.description}</p>
      </div>
    </Link>
  )
}
