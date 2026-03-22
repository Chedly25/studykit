import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ClerkProvider } from '@clerk/clerk-react'
import { Toaster } from 'sonner'
import './i18n'
import './styles/globals.css'
import App from './App'
import { BackgroundJobsProvider } from './components/BackgroundJobsProvider'

// Register service worker for offline caching + push
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

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
        </BrowserRouter>
      </ClerkProvider>
    </HelmetProvider>
  </StrictMode>,
)
