import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { categories, getToolsByCategory } from '../lib/tools'
import { ToolCard } from '../components/ToolCard'

export default function AllTools() {
  const { t } = useTranslation()

  return (
    <>
      <Helmet>
        <title>All Tools — StudiesKit</title>
        <meta name="description" content="Browse all free student productivity tools. Grade calculators, writing tools, study timers, flashcards, and reference tools." />
      </Helmet>

      <div className="animate-fade-in">
        <div className="text-center mb-10">
          <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-[var(--text-heading)] mb-2">
            {t('tools.allTools')}
          </h1>
          <p className="text-[var(--text-muted)] text-lg">{t('tools.allToolsSubtitle')}</p>
        </div>

        {categories.map(cat => {
          const catTools = getToolsByCategory(cat.id)
          const CatIcon = cat.icon
          return (
            <section key={cat.id} className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <CatIcon size={18} className="text-[var(--accent-text)]" />
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--text-heading)]">
                  {cat.label}
                </h2>
                <span className="text-[var(--text-faint)] text-sm">({catTools.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {catTools.map(tool => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
