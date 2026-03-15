import { useTranslation } from 'react-i18next'

export function ProBadge() {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--accent-bg)] text-[var(--accent-text)]">
      {t('common.pro')}
    </span>
  )
}
