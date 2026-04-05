# StudiesKit

AI-powered study platform for exam preparation. Supports French bar exam (CRFPA), CPGE concours, university courses, and custom study programs. Features an AI tutor, spaced repetition, practice exams, document analysis, and progress tracking.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4
- **Storage:** IndexedDB (Dexie.js) — offline-first, data stays on device
- **Backend:** Cloudflare Pages Functions (Workers)
- **AI:** Cloudflare Workers AI, Anthropic Claude, Kimi (OpenAI-compatible)
- **Auth:** Clerk
- **Billing:** Stripe (EUR)
- **i18n:** i18next (French / English)

## Prerequisites

- Node.js 20+
- A [Clerk](https://clerk.com) project
- A [Stripe](https://stripe.com) account with EUR pricing
- A [Cloudflare](https://cloudflare.com) account (Pages + Workers AI + KV)

## Environment Variables

### Client-side (`.env`)

```
VITE_CLERK_PUBLISHABLE_KEY=pk_...     # Clerk publishable key
VITE_SENTRY_DSN=                       # Sentry DSN (optional)
```

### Server-side (Cloudflare Workers secrets / `.dev.vars`)

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_API_KEY` | Yes | API key for the main LLM (Kimi/OpenAI-compatible) |
| `CLERK_ISSUER_URL` | Yes | Clerk JWT issuer URL |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Yes | Stripe monthly price ID |
| `STRIPE_PRO_YEARLY_PRICE_ID` | Yes | Stripe yearly price ID |
| `ADMIN_EMAIL` | Yes | Admin user email for dashboard access |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (for vision/advanced features) |
| `TAVILY_API_KEY` | No | Tavily API key (web search) |
| `RESEND_API_KEY` | No | Resend API key (email notifications) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | No | Web push notification keys |

### Cloudflare Bindings

| Binding | Type | Description |
|---------|------|-------------|
| `AI` | Workers AI | Cloudflare Workers AI (embeddings) |
| `USAGE_KV` | KV Namespace | Rate limiting, cost protection, usage stats |
| `SYNC_KV` | KV Namespace | Cross-device sync for Pro users |
| `PUSH_SUBSCRIPTIONS` | KV Namespace | Push notification subscriptions |

## Local Development

```bash
npm install
npm run dev          # Vite dev server (frontend only)
npm run dev:worker   # Cloudflare Pages dev (frontend + API functions)
```

## Running Tests

```bash
npm test             # Run all tests (Vitest)
npm run test:coverage # With coverage report
```

221+ tests covering AI agents, spaced repetition, hybrid search, cost protection, and more.

## Deployment

```bash
npm run build        # Build for production
npm run deploy       # Deploy to Cloudflare Pages
```

Cloudflare Pages auto-deploys from `main` branch pushes.

## Architecture

```
studieskit/
  src/
    ai/          # AI agents, prompts, workflows, memory
    components/  # React components (chat, dashboard, reader, etc.)
    db/          # IndexedDB schema (Dexie), migrations, seed data
    hooks/       # React hooks (exam profile, analytics, agent, etc.)
    i18n/        # Translations (en.json, fr.json)
    lib/         # Utilities (SRS, search, export, grading, etc.)
    pages/       # Route page components
  functions/
    api/         # Cloudflare Pages Functions (REST endpoints)
    lib/         # Server-side utilities (auth, CORS, cost protection)
  public/        # Static assets, audio files, PWA manifest
```

**Key design decisions:**
- **Offline-first:** All study data lives in IndexedDB. The app works without internet for flashcards, exercises, and document reading.
- **AI as infrastructure:** AI features (tutor, exam generation, document analysis) run server-side via Cloudflare Workers. The client sends prompts and receives structured responses.
- **Plan-aware rate limiting:** Free users get 25 AI messages/day, Pro users get 500. A global kill switch caps total API spend.

## License

Proprietary. All rights reserved.
