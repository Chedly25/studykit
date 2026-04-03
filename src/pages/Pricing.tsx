import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { Check, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSubscription } from '../hooks/useSubscription'
import { useCheckout } from '../hooks/useCheckout'

export default function Pricing() {
  const { t } = useTranslation()
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const { isPro } = useSubscription()
  const { checkout, openPortal, loading } = useCheckout()

  const FREE_FEATURES = [
    t('subscription.freeFeatures.tools'),
    t('subscription.freeFeatures.profile'),
    t('subscription.freeFeatures.messages', { count: 25 }),
    t('subscription.freeFeatures.documents', { count: 3 }),
    t('subscription.freeFeatures.exams'),
  ]

  const PRO_FEATURES = [
    t('subscription.proFeatures.unlimited'),
    t('subscription.proFeatures.unlimitedExams'),
    t('subscription.proFeatures.unlimitedDocs'),
    t('subscription.proFeatures.profiles'),
    t('subscription.proFeatures.cloudSync'),
    t('subscription.proFeatures.voicePhoto'),
    t('subscription.proFeatures.examDna'),
    t('subscription.proFeatures.priority'),
  ]

  const price = interval === 'year' ? '199.99' : '19.99'
  const perMonth = interval === 'year' ? '16.67' : '19.99'
  const savings = interval === 'year' ? t('subscription.yearlySavings') : null

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-[var(--text-heading)] mb-3">
          {t('subscription.pricing')}
        </h1>
        <p className="text-[var(--text-muted)] max-w-lg mx-auto">
          {t('subscription.pricingSubtitle', 'Study for free with 25 AI messages/day and 2 practice exams/month. Go Pro for unlimited everything.')}
        </p>

        {/* Interval toggle */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setInterval('month')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              interval === 'month'
                ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval('year')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              interval === 'year'
                ? 'bg-[var(--accent-bg)] text-[var(--accent-text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Free */}
        <div className="glass-card p-6 flex flex-col">
          <h2 className="text-xl font-bold text-[var(--text-heading)] mb-1">{t('subscription.freePlan')}</h2>
          <div className="text-3xl font-bold text-[var(--text-heading)] mb-1">
            EUR 0<span className="text-sm font-normal text-[var(--text-muted)]">/month</span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-6">For getting started</p>

          <ul className="space-y-3 flex-1">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-body)]">
                <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-6">
            {isPro ? (
              <span className="block text-center text-sm text-[var(--text-muted)]">
                {t('subscription.previousPlan')}
              </span>
            ) : (
              <span className="block text-center text-sm text-[var(--text-muted)] font-medium">
                {t('subscription.currentPlan')}
              </span>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className="glass-card p-6 flex flex-col ring-2 ring-[var(--accent-text)]/30">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-[var(--text-heading)]">{t('subscription.proPlan')}</h2>
            <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />
          </div>
          <div className="text-3xl font-bold text-[var(--text-heading)] mb-1">
            EUR {price}
            <span className="text-sm font-normal text-[var(--text-muted)]">
              /{interval === 'year' ? 'year' : 'month'}
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            EUR {perMonth}/mo{savings && <> &middot; <span className="text-[var(--accent-text)] font-medium">{savings}</span></>}
          </p>

          <ul className="space-y-3 flex-1">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-body)]">
                <Check className="w-4 h-4 text-[var(--accent-text)] mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <SignedIn>
              {isPro ? (
                <button
                  onClick={() => openPortal()}
                  disabled={loading}
                  className="btn-secondary w-full py-2.5 text-sm disabled:opacity-50"
                >
                  {loading ? t('common.loading') : t('subscription.manageSubscription')}
                </button>
              ) : (
                <button
                  onClick={() => checkout(interval)}
                  disabled={loading}
                  className="btn-primary w-full py-2.5 text-sm disabled:opacity-50"
                >
                  {loading ? t('common.loading') : t('subscription.upgradeNow')}
                </button>
              )}
            </SignedIn>
            <SignedOut>
              <Link to="/sign-up" className="btn-primary block text-center w-full py-2.5 text-sm">
                {t('common.signUp')}
              </Link>
            </SignedOut>
          </div>
        </div>
      </div>
    </div>
  )
}
