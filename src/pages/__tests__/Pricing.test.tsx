import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockUseSubscription, mockCheckout, mockOpenPortal } = vi.hoisted(() => ({
  mockUseSubscription: vi.fn(),
  mockCheckout: vi.fn(),
  mockOpenPortal: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}))

vi.mock('../../hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}))

vi.mock('../../hooks/useCheckout', () => ({
  useCheckout: () => ({
    checkout: mockCheckout,
    openPortal: mockOpenPortal,
    loading: false,
  }),
}))

vi.mock('@clerk/clerk-react', () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: () => null,
  useUser: () => ({ user: { publicMetadata: {} }, isLoaded: true }),
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('tok') }),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}))

vi.mock('lucide-react', () => ({
  Check: () => <span data-testid="check-icon" />,
  Sparkles: () => <span data-testid="sparkles-icon" />,
}))

import Pricing from '../Pricing'

describe('Pricing', () => {
  it('renders free and pro plan cards', () => {
    mockUseSubscription.mockReturnValue({ isPro: false, plan: 'free' })

    render(<Pricing />)

    expect(screen.getByText('subscription.freePlan')).toBeInTheDocument()
    expect(screen.getByText('subscription.proPlan')).toBeInTheDocument()
  })

  it('shows "Upgrade Now" button for free users', () => {
    mockUseSubscription.mockReturnValue({ isPro: false, plan: 'free' })

    render(<Pricing />)

    expect(screen.getByText('subscription.upgradeNow')).toBeInTheDocument()
  })

  it('shows "Manage Subscription" button for pro users', () => {
    mockUseSubscription.mockReturnValue({ isPro: true, plan: 'pro' })

    render(<Pricing />)

    expect(screen.getByText('subscription.manageSubscription')).toBeInTheDocument()
  })
})
