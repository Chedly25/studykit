/**
 * Tests for useCheckout hook — Stripe checkout + portal with URL validation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockGetToken = vi.fn().mockResolvedValue('test-token')

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Prevent actual navigation
const originalLocation = window.location
beforeEach(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...originalLocation, href: '' },
  })
})

import { useCheckout } from '../useCheckout'

describe('useCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetToken.mockResolvedValue('test-token')
  })

  describe('checkout', () => {
    it('calls /api/stripe/checkout with correct headers and body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://checkout.stripe.com/session123' }),
      })

      const { result } = renderHook(() => useCheckout())

      await act(async () => {
        await result.current.checkout('month')
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ interval: 'month' }),
      })
    })

    it('redirects to valid Stripe checkout URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://checkout.stripe.com/session123' }),
      })

      const { result } = renderHook(() => useCheckout())

      await act(async () => {
        await result.current.checkout('year')
      })

      expect(window.location.href).toBe('https://checkout.stripe.com/session123')
    })

    it('rejects non-HTTPS URLs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'http://evil.com/steal-data' }),
      })

      const { result } = renderHook(() => useCheckout())

      await expect(
        act(async () => { await result.current.checkout('month') })
      ).rejects.toThrow('Invalid checkout URL')
    })

    it('rejects URLs from wrong hostname', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://evil-stripe.com/fake' }),
      })

      const { result } = renderHook(() => useCheckout())

      await expect(
        act(async () => { await result.current.checkout('month') })
      ).rejects.toThrow('Invalid checkout URL')
    })

    it('throws on API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Payment config missing' }),
      })

      const { result } = renderHook(() => useCheckout())

      await expect(
        act(async () => { await result.current.checkout('month') })
      ).rejects.toThrow('Payment config missing')
    })

    it('resets loading state on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Failed' }),
      })

      const { result } = renderHook(() => useCheckout())

      try {
        await act(async () => { await result.current.checkout('month') })
      } catch { /* expected */ }

      expect(result.current.loading).toBe(false)
    })
  })

  describe('openPortal', () => {
    it('calls /api/stripe/portal with auth header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://billing.stripe.com/session456' }),
      })

      const { result } = renderHook(() => useCheckout())

      await act(async () => {
        await result.current.openPortal()
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      })
    })

    it('redirects to valid billing portal URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://billing.stripe.com/portal789' }),
      })

      const { result } = renderHook(() => useCheckout())

      await act(async () => {
        await result.current.openPortal()
      })

      expect(window.location.href).toBe('https://billing.stripe.com/portal789')
    })

    it('rejects invalid portal URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://phishing.com/portal' }),
      })

      const { result } = renderHook(() => useCheckout())

      await expect(
        act(async () => { await result.current.openPortal() })
      ).rejects.toThrow('Invalid portal URL')
    })
  })
})
