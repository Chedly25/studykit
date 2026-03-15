import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import { ArrowRight, GraduationCap } from 'lucide-react'
import { categories, getToolsByCategory } from '../lib/tools'
import { ToolCard } from '../components/ToolCard'
import { useExamProfile } from '../hooks/useExamProfile'
import Dashboard from './Dashboard'

const popularSlugs = [
  'gpa-calculator',
  'word-counter',
  'pomodoro-timer',
  'flashcard-maker',
  'citation-generator',
  'assignment-tracker',
]

export default function Home() {
  const { isSignedIn } = useAuth()
  const { activeProfile } = useExamProfile()

  // If signed in with an active exam profile, show the dashboard
  if (isSignedIn && activeProfile) {
    return <Dashboard />
  }

  const allTools = categories.flatMap(c => getToolsByCategory(c.id))
  const popular = popularSlugs
    .map(slug => allTools.find(t => t.slug === slug)!)
    .filter(Boolean)

  return (
    <>
      <Helmet>
        <title>StudiesKit — AI-Powered Exam Preparation Platform</title>
        <meta
          name="description"
          content="AI-powered exam preparation for Bar, USMLE, CFA, and more. Knowledge graph, adaptive testing, Socratic tutoring, and smart study tools. All in your browser."
        />
      </Helmet>

      <div className="animate-fade-in">
        {/* Hero */}
        <section className="text-center py-16 md:py-24">
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl font-bold text-[var(--text-heading)] mb-4">
            Ace your
            <span className="text-[var(--accent-text)]"> professional exam</span>
          </h1>
          <p className="text-[var(--text-muted)] text-lg md:text-xl max-w-2xl mx-auto mb-8">
            AI-powered exam preparation for the Bar, USMLE, CFA, and more. Knowledge graph tracking, adaptive testing, Socratic tutoring — all running in your browser.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/exam-profile" className="btn-primary inline-flex items-center gap-2">
              <GraduationCap size={18} /> Start Preparing
            </Link>
            <Link to="/all-tools" className="btn-secondary inline-flex items-center gap-2">
              Browse Tools <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* Popular Tools */}
        <section className="mb-16">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-heading)] mb-6">
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
                <div className="w-9 h-9 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center">
                  <CatIcon size={18} className="text-[var(--accent-text)]" />
                </div>
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--text-heading)]">
                    {cat.label}
                  </h2>
                  <p className="text-[var(--text-muted)] text-sm">{cat.description}</p>
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
