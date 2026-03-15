import { Helmet } from 'react-helmet-async'
import { categories, getToolsByCategory } from '../lib/tools'
import { ToolCard } from '../components/ToolCard'

export default function AllTools() {
  return (
    <>
      <Helmet>
        <title>All Tools — StudyKit</title>
        <meta name="description" content="Browse all 20 free student productivity tools. Calculators, writing tools, study timers, flashcards, and reference tools." />
      </Helmet>

      <div className="animate-fade-in">
        <div className="text-center mb-10">
          <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-surface-50 mb-2">
            All Tools
          </h1>
          <p className="text-surface-400 text-lg">20 free tools for students</p>
        </div>

        {categories.map(cat => {
          const catTools = getToolsByCategory(cat.id)
          const CatIcon = cat.icon
          return (
            <section key={cat.id} className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <CatIcon size={18} className="text-primary-400" />
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-surface-100">
                  {cat.label}
                </h2>
                <span className="text-surface-600 text-sm">({catTools.length})</span>
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
