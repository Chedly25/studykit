import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminGuard } from '../AdminGuard'

const mockGetToken = vi.fn().mockResolvedValue('fake-token')

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: mockGetToken,
    isLoaded: true,
    userId: 'test-user',
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  }
})

function renderGuard() {
  return render(
    <MemoryRouter>
      <AdminGuard>
        <div data-testid="protected-content">Admin Content</div>
      </AdminGuard>
    </MemoryRouter>,
  )
}

describe('AdminGuard', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    sessionStorage.clear()
    mockGetToken.mockResolvedValue('fake-token')
  })

  afterEach(() => {
    fetchSpy?.mockRestore()
  })

  it('shows loading state initially', () => {
    // Never resolve the fetch so we stay in loading
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))
    renderGuard()
    // The loading spinner has animate-spin class
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders children when user is admin', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ admin: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    renderGuard()

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })
  })

  it('redirects to / when user is not admin', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ admin: false }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    renderGuard()

    await waitFor(() => {
      const nav = screen.getByTestId('navigate')
      expect(nav).toBeInTheDocument()
      expect(nav.getAttribute('data-to')).toBe('/')
    })
  })
})
