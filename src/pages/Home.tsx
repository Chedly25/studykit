import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@clerk/clerk-react'
import { GraduationCap, ArrowRight, ArrowDown } from 'lucide-react'
import { useExamProfile } from '../hooks/useExamProfile'
import { InteractiveDemo } from '../components/home/InteractiveDemo'
import { FeaturePillars } from '../components/home/FeaturePillars'
import Dashboard from './Dashboard'

export default function Home() {
  const { t } = useTranslation()
  const { isSignedIn } = useAuth()
  const { activeProfile } = useExamProfile()

  // Signed in with profile → show dashboard
  if (isSignedIn && activeProfile) {
    return <Dashboard />
  }

  // Signed in without profile → show onboarding CTA
  if (isSignedIn && !activeProfile) {
    return (
      <>
        <Helmet>
          <title>StudiesKit — {t('common.tagline')}</title>
        </Helmet>
        <div className="animate-fade-in text-center py-16 max-w-2xl mx-auto">
          <GraduationCap className="w-16 h-16 text-[var(--accent-text)] mx-auto mb-6" />
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-heading)] mb-4">
            {t('home.onboardingTitle')}
          </h1>
          <p className="text-[var(--text-muted)] text-lg mb-8">
            {t('home.onboardingSubtitle')}
          </p>
          <Link to="/exam-profile" className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-lg">
            <GraduationCap size={20} /> {t('home.createProfile')}
          </Link>
        </div>
      </>
    )
  }

  // Signed out → full sign-up funnel
  return (
    <>
      <Helmet>
        <title>StudiesKit — {t('common.tagline')}</title>
        <meta
          name="description"
          content="AI-powered learning platform for university courses, professional certifications, language exams, and more. Personal AI tutor, knowledge tracking, adaptive practice."
        />
      </Helmet>

      <div className="animate-fade-in">
        {/* Hero Section */}
        <section className="text-center py-16 md:py-24">
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl font-bold text-[var(--text-heading)] mb-4">
            {t('home.heroTitle')}
          </h1>
          <p className="text-[var(--text-muted)] text-lg md:text-xl max-w-2xl mx-auto mb-8">
            {t('home.heroSubtitle')}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/sign-up" className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-lg">
              <GraduationCap size={20} /> {t('home.startLearning')}
            </Link>
            <a
              href="#demo"
              className="btn-secondary inline-flex items-center gap-2 px-6 py-3"
            >
              {t('home.tryDemo')} <ArrowDown size={18} />
            </a>
          </div>
        </section>

        {/* Interactive Demo */}
        <section id="demo" className="py-12 md:py-20">
          <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl font-bold text-[var(--text-heading)] text-center mb-8">
            {t('home.demoTitle')}
          </h2>
          <InteractiveDemo />
          <div className="text-center mt-8">
            <Link to="/sign-up" className="btn-primary inline-flex items-center gap-2 px-6 py-2.5">
              {t('home.getOwnTutor')} <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* Feature Pillars */}
        <section className="py-12 md:py-20">
          <FeaturePillars />
        </section>

        {/* Final CTA */}
        <section className="text-center py-16 md:py-24">
          <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-4xl font-bold text-[var(--text-heading)] mb-4">
            {t('home.finalCta')}
          </h2>
          <p className="text-[var(--text-muted)] text-lg max-w-xl mx-auto mb-8">
            {t('home.finalCtaSubtitle')}
          </p>
          <Link to="/sign-up" className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg">
            {t('home.signUpFree')} <ArrowRight size={20} />
          </Link>
        </section>
      </div>
    </>
  )
}
