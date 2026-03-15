import { toolContent } from '../lib/toolContent'

interface ToolContentSectionProps {
  toolId: string
}

export function ToolContentSection({ toolId }: ToolContentSectionProps) {
  const content = toolContent[toolId]
  if (!content) return null

  return (
    <div className="mt-16 max-w-3xl mx-auto space-y-10 animate-fade-in">
      {content.content && (
        <div className="glass-card p-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-heading)] mb-3">
            About This Tool
          </h2>
          <p className="text-[var(--text-muted)] leading-relaxed">{content.content}</p>
        </div>
      )}

      {content.faqs.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-heading)] mb-4">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {content.faqs.map((faq, i) => (
              <details key={i} className="group">
                <summary className="cursor-pointer text-[var(--text-body)] font-medium hover:text-[var(--accent-text)] transition-colors list-none flex items-center gap-2">
                  <span className="text-[var(--accent-text)] transition-transform group-open:rotate-90">&#9654;</span>
                  {faq.question}
                </summary>
                <p className="mt-2 ml-5 text-[var(--text-muted)] leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
