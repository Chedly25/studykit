/**
 * PostHog analytics — thin wrapper for event tracking.
 * EU hosting for GDPR compliance, manual events only.
 */
import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined

export function initAnalytics() {
  if (!POSTHOG_KEY) return
  posthog.init(POSTHOG_KEY, {
    api_host: 'https://eu.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    persistence: 'localStorage',
    respect_dnt: true,
  })
}

export function identify(userId: string, props?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return
  posthog.identify(userId, props)
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return
  posthog.capture(event, props)
}

export function setUserProps(props: Record<string, unknown>) {
  if (!POSTHOG_KEY) return
  posthog.people.set(props)
}
