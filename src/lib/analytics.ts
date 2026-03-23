/**
 * PostHog analytics — thin wrapper for event tracking.
 * EU hosting for GDPR compliance, manual events only.
 * PostHog is dynamically imported to keep it out of the main bundle.
 */

type PostHog = {
  init: (key: string, config: Record<string, unknown>) => void
  identify: (userId: string, props?: Record<string, unknown>) => void
  capture: (event: string, props?: Record<string, unknown>) => void
  people: { set: (props: Record<string, unknown>) => void }
}

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined

let ph: PostHog | null = null

export async function initAnalytics() {
  if (!POSTHOG_KEY) return
  try {
    const { default: posthog } = await import('posthog-js')
    posthog.init(POSTHOG_KEY, {
      api_host: 'https://eu.i.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
      persistence: 'localStorage',
      respect_dnt: true,
    })
    ph = posthog as unknown as PostHog
  } catch { /* non-critical */ }
}

export function identify(userId: string, props?: Record<string, unknown>) {
  if (!ph) return
  ph.identify(userId, props)
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!ph) return
  ph.capture(event, props)
}

export function setUserProps(props: Record<string, unknown>) {
  if (!ph) return
  ph.people.set(props)
}
