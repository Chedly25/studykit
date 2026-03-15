import type { ReactNode } from 'react'
import { ToolContentSection } from './ToolContentSection'

interface FormToolPageProps {
  toolId: string
  title: string
  description: string
  children: ReactNode
}

export function FormToolPage({ toolId, title, description, children }: FormToolPageProps) {
  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-surface-50 mb-2">
          {title}
        </h1>
        <p className="text-surface-400 text-lg">{description}</p>
      </div>

      <div className="max-w-4xl mx-auto">
        {children}
      </div>

      <ToolContentSection toolId={toolId} />
    </div>
  )
}
