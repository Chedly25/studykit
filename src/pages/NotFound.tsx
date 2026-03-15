import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home } from 'lucide-react'

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="text-center py-24 animate-fade-in">
      <h1 className="font-[family-name:var(--font-display)] text-6xl font-bold text-[var(--text-faint)] mb-4">
        404
      </h1>
      <p className="text-[var(--text-muted)] text-lg mb-6">{t('notFound.subtitle')}</p>
      <Link to="/" className="btn-primary inline-flex items-center gap-2">
        <Home size={18} /> {t('notFound.goHome')}
      </Link>
    </div>
  )
}
