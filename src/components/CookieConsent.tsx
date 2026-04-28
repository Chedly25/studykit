/**
 * GDPR cookie/analytics consent banner.
 * Shows only when user hasn't made a choice yet.
 * Saves consent to localStorage and dispatches a custom event so analytics can react.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// ---------------------------------------------------------------------------
// Consent helpers (importable from anywhere)
// ---------------------------------------------------------------------------

export function getGdprConsent(): {analytics: boolean; errorTracking: boolean} | null {
  try {
    const raw = localStorage.getItem('gdpr_consent')
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function hasAnalyticsConsent(): boolean {
  return getGdprConsent()?.analytics === true
}

export function hasErrorTrackingConsent(): boolean {
  return getGdprConsent()?.errorTracking === true
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function saveConsent(analytics: boolean, errorTracking: boolean) {
  const consent = {
    analytics,
    errorTracking,
    timestamp: new Date().toISOString(),
  }
  localStorage.setItem('gdpr_consent', JSON.stringify(consent))
  window.dispatchEvent(new CustomEvent('gdpr-consent-changed', { detail: consent }))
}

export default function CookieConsent() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(() => getGdprConsent() === null)
  const [customizing, setCustomizing] = useState(false)
  const [analytics, setAnalytics] = useState(true)
  const [errorTracking, setErrorTracking] = useState(true)

  if (!visible) return null

  const handleAcceptAll = () => {
    saveConsent(true, true)
    setVisible(false)
  }

  const handleRejectAll = () => {
    saveConsent(false, false)
    setVisible(false)
  }

  const handleSaveCustom = () => {
    saveConsent(analytics, errorTracking)
    setVisible(false)
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 animate-fade-in">
      <div className="max-w-2xl mx-auto bg-[var(--bg-card)] border border-[var(--border-card)] backdrop-blur-xl rounded-2xl shadow-xl p-5 sm:p-6">
        <h3 className="text-base font-semibold text-[var(--text-heading)] mb-2">
          {t('gdpr.title', 'We value your privacy')}
        </h3>
        <p className="text-sm text-[var(--text-body)] mb-4 leading-relaxed">
          {t(
            'gdpr.description',
            'We use cookies and similar technologies to improve your experience, analyze usage, and track errors. You can choose which optional cookies to allow.'
          )}
        </p>

        {customizing && (
          <div className="space-y-3 mb-4 p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-card)]">
            {/* Essential — always on */}
            <label className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium text-[var(--text-heading)]">
                  {t('gdpr.essential', 'Essential cookies')}
                </span>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('gdpr.essentialDesc', 'Required for the site to function. Cannot be disabled.')}
                </p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked
                  disabled
                  className="sr-only peer"
                />
                <div className="w-10 h-6 rounded-full bg-[var(--color-accent-500)] opacity-60 cursor-not-allowed" />
                <div className="absolute top-0.5 left-[18px] w-5 h-5 rounded-full bg-white shadow transition-transform" />
              </div>
            </label>

            {/* Analytics (PostHog) */}
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <span className="text-sm font-medium text-[var(--text-heading)]">
                  {t('gdpr.analytics', 'Analytics (PostHog)')}
                </span>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('gdpr.analyticsDesc', 'Helps us understand how you use the app so we can improve it. EU-hosted.')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={analytics}
                onClick={() => setAnalytics(!analytics)}
                className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
                  analytics ? 'bg-[var(--color-accent-500)]' : 'bg-[var(--text-faint)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    analytics ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
            </label>

            {/* Error Tracking (Sentry) */}
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <span className="text-sm font-medium text-[var(--text-heading)]">
                  {t('gdpr.errorTracking', 'Error Tracking (Sentry)')}
                </span>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('gdpr.errorTrackingDesc', 'Helps us detect and fix bugs faster.')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={errorTracking}
                onClick={() => setErrorTracking(!errorTracking)}
                className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
                  errorTracking ? 'bg-[var(--color-accent-500)]' : 'bg-[var(--text-faint)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    errorTracking ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {customizing ? (
            <button
              onClick={handleSaveCustom}
              className="btn-primary px-5 py-2 text-sm font-medium"
            >
              {t('gdpr.savePreferences', 'Save preferences')}
            </button>
          ) : (
            <>
              <button
                onClick={handleAcceptAll}
                className="btn-primary px-5 py-2 text-sm font-medium"
              >
                {t('gdpr.acceptAll', 'Accept All')}
              </button>
              <button
                onClick={handleRejectAll}
                className="px-5 py-2 text-sm font-medium rounded-lg border border-[var(--border-card)] text-[var(--text-body)] hover:bg-[var(--bg-input)] transition-colors"
              >
                {t('gdpr.rejectAll', 'Reject All')}
              </button>
              <button
                onClick={() => setCustomizing(true)}
                className="px-5 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
              >
                {t('gdpr.customize', 'Customize')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
