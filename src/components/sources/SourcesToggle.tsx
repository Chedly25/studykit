import { BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  documentCount: number
}

export function SourcesToggle({ enabled, onToggle, documentCount }: Props) {
  const { t } = useTranslation()
  const isDisabled = documentCount === 0

  return (
    <button
      onClick={() => !isDisabled && onToggle(!enabled)}
      disabled={isDisabled}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
        enabled
          ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
          : 'bg-[var(--bg-input)] text-[var(--text-muted)]'
      } ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}
      title={isDisabled ? 'Upload sources first' : enabled ? 'Disable sources' : 'Enable sources'}
    >
      <BookOpen size={12} />
      <span>{t('ai.useSources')} ({t('sources.documentCount', { count: documentCount })})</span>
      <div
        className={`w-6 h-3.5 rounded-full relative transition-colors ${
          enabled ? 'bg-[var(--accent-text)]' : 'bg-[var(--text-faint)]/30'
        }`}
      >
        <div
          className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-3' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  )
}
