import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowRight } from 'lucide-react'
import { categories, getToolsByCategory } from '../lib/tools'
import { ToolCard } from '../components/ToolCard'

const popularSlugs = [
  'gpa-calculator',
  'word-counter',
  'pomodoro-timer',
  'percentage-calculator',
  'flashcard-maker',
  'citation-generator',
]

export default function Home() {
  const allTools = categories.flatMap(c => getToolsByCategory(c.id))
  const popular = popularSlugs
    .map(slug => allTools.find(t => t.slug === slug)!)
    .filter(Boolean)

  return (
    <>
      <Helmet>
        <title>StudyKit — Free Student Productivity Tools</title>
        <meta
          name="description"
          content="Free student tools that run in your browser. GPA calculator, word counter, pomodoro timer, flashcards, citation generator, and more. No sign-up required."
        />
      </Helmet>

      <div className="animate-fade-in">
        {/* Hero */}
        <section className="text-center py-16 md:py-24">
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl font-bold text-surface-50 mb-4">
            Student tools that
            <span className="text-primary-400"> just work</span>
          </h1>
          <p className="text-surface-400 text-lg md:text-xl max-w-2xl mx-auto mb-8">
            20 free tools for students. GPA calculator, word counter, pomodoro timer, flashcards, and more. Runs entirely in your browser — no sign-up, no data collection.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/all-tools" className="btn-primary inline-flex items-center gap-2">
              Browse All Tools <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* Popular Tools */}
        <section className="mb-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-surface-100 mb-6">
            Popular Tools
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popular.map(tool => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>

        {/* Category Sections */}
        {categories.map(cat => {
          const catTools = getToolsByCategory(cat.id)
          const CatIcon = cat.icon
          return (
            <section key={cat.id} className="mb-12">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center">
                  <CatIcon size={18} className="text-primary-400" />
                </div>
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-surface-100">
                    {cat.label}
                  </h2>
                  <p className="text-surface-500 text-sm">{cat.description}</p>
                </div>
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
