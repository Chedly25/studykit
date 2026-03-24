import { useTranslation } from 'react-i18next'
import { db } from '../db'

export function LanguageToggle() {
  const { i18n } = useTranslation()
  const current = i18n.language?.startsWith('fr') ? 'fr' : 'en'

  const toggle = async () => {
    const next = current === 'en' ? 'fr' : 'en'
    await i18n.changeLanguage(next)
    localStorage.setItem('studieskit-language', next)
    try {
      await db.userPreferences.update('default', { language: next })
    } catch {
      // preferences row may not exist yet
    }
  }

  return (
    <button
      onClick={toggle}
      className="px-2 py-1 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--accent-bg)] transition-colors"
      aria-label={`Switch to ${current === 'en' ? 'French' : 'English'}`}
    >
      {current === 'en' ? 'EN' : 'FR'}
    </button>
  )
}
