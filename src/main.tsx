import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ClerkProvider } from '@clerk/clerk-react'
import './i18n'
import './styles/globals.css'
import App from './App'

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
          <App />
        </BrowserRouter>
      </ClerkProvider>
    </HelmetProvider>
  </StrictMode>,
)
