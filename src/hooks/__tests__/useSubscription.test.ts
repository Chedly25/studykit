import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockUseUser = vi.fn()

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => mockUseUser(),
}))

import { useSubscription } from '../useSubscription'

describe('useSubscription', () => {
  it('returns isPro=true when publicMetadata.plan is pro', () => {
    mockUseUser.mockReturnValue({
      user: { publicMetadata: { plan: 'pro', stripeCustomerId: 'cus_123' } },
      isLoaded: true,
    })

    const { result } = renderHook(() => useSubscription())

    expect(result.current.isPro).toBe(true)
    expect(result.current.plan).toBe('pro')
  })

  it('returns isPro=false when publicMetadata.plan is free', () => {
    mockUseUser.mockReturnValue({
      user: { publicMetadata: { plan: 'free' } },
      isLoaded: true,
    })

    const { result } = renderHook(() => useSubscription())

    expect(result.current.isPro).toBe(false)
    expect(result.current.plan).toBe('free')
  })

  it('returns isLoading=true when user is loading', () => {
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: false,
    })

    const { result } = renderHook(() => useSubscription())

    expect(result.current.isLoading).toBe(true)
  })

  it('returns cancelAtPeriodEnd from metadata', () => {
    mockUseUser.mockReturnValue({
      user: { publicMetadata: { plan: 'pro', cancelAtPeriodEnd: true } },
      isLoaded: true,
    })

    const { result } = renderHook(() => useSubscription())

    expect(result.current.cancelAtPeriodEnd).toBe(true)
  })
})
