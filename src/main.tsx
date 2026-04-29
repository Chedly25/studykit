import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ClerkProvider } from '@clerk/clerk-react'
import { Toaster } from 'sonner'
import * as Sentry from '@sentry/react'
import './i18n'
import './styles/globals.css'
import App from './App'
import { BackgroundJobsProvider } from './components/BackgroundJobsProvider'
import { CommandRegistryProvider } from './lib/commands'
import { KeyboardShortcutsProvider } from './lib/keyboard'
import { initAnalytics, refreshAnalyticsConsent } from './lib/analytics'

// Initialize Sentry error monitoring — gated on GDPR consent
function hasErrorTrackingConsent(): boolean {
  try {
    const raw = localStorage.getItem('gdpr_consent')
    if (!raw) return false
    return JSON.parse(raw).errorTracking === true
  } catch { return false }
}

if (import.meta.env.VITE_SENTRY_DSN && hasErrorTrackingConsent()) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  })
}

// Initialize PostHog analytics (no-op if VITE_POSTHOG_KEY not set or no consent)
initAnalytics()

// Re-initialize analytics/Sentry when user changes consent in the current session
window.addEventListener('gdpr-consent-changed', () => {
  refreshAnalyticsConsent()
  if (import.meta.env.VITE_SENTRY_DSN && hasErrorTrackingConsent() && !Sentry.getClient()) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    })
  }
})

// Register service worker via vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register'
registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('sw-update-available'))
  },
  onOfflineReady() { /* Service worker ready for offline use */ },
})

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
if (!CLERK_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <ClerkProvider
        publishableKey={CLERK_KEY}
        appearance={{
          variables: {
            colorPrimary: 'var(--accent-text)',
            colorBackground: 'var(--bg-card)',
            colorText: 'var(--text-heading)',
            colorInputBackground: 'var(--bg-input)',
            borderRadius: '0.5rem',
          },
        }}
      >
        <BrowserRouter>
          <KeyboardShortcutsProvider>
            <CommandRegistryProvider>
              <BackgroundJobsProvider>
                <App />
              </BackgroundJobsProvider>
              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: 'var(--bg-card)',
                    color: 'var(--text-body)',
                    border: '1px solid var(--border-card)',
                    borderRadius: '0.75rem',
                  },
                }}
              />
            </CommandRegistryProvider>
          </KeyboardShortcutsProvider>
        </BrowserRouter>
      </ClerkProvider>
    </HelmetProvider>
  </StrictMode>,
)
