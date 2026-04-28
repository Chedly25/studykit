import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GrandArretViewer } from '../GrandArretViewer'
import { GRANDS_ARRETS } from '../../../../../scripts/data/grandsArretsSeed'

const blanco = GRANDS_ARRETS.find(a => a.slug === 'tc-blanco-1873')

describe('GrandArretViewer', () => {
  it('renders the canonical Blanco arrêt with all sections', () => {
    if (!blanco) throw new Error('seed missing tc-blanco-1873 — test fixture broken')
    render(<GrandArretViewer slug="tc-blanco-1873" />)
    expect(screen.getByRole('heading', { name: blanco.name })).toBeTruthy()
    expect(screen.getByText(/TC/)).toBeTruthy()
    expect(screen.getByText(/8 février 1873/)).toBeTruthy()
    expect(screen.getByText(/Portée/i)).toBeTruthy()
    if (blanco.attendu) expect(screen.getByText(/Attendu/i)).toBeTruthy()
  })

  it('renders gracefully when the slug is unknown', () => {
    render(<GrandArretViewer slug="not-an-arret" />)
    expect(screen.getByText(/introuvable/i)).toBeTruthy()
  })

  it('omits the Attendu section when attendu is missing', () => {
    // Pick a seed entry without attendu (Cadot 1889 is one).
    const cadot = GRANDS_ARRETS.find(a => a.slug === 'ce-cadot-1889')
    if (!cadot) throw new Error('seed missing ce-cadot-1889')
    expect(cadot.attendu).toBeUndefined()
    render(<GrandArretViewer slug="ce-cadot-1889" />)
    expect(screen.queryByText(/Attendu/i)).toBeFalsy()
  })

  it('omits the Wikipedia link when wikipediaSlug is missing', () => {
    const noWiki = GRANDS_ARRETS.find(a => !a.wikipediaSlug)
    if (!noWiki) return // skip if all seeds have wiki — test still passes
    render(<GrandArretViewer slug={noWiki.slug} />)
    expect(screen.queryByText(/Wikipédia/i)).toBeFalsy()
  })
})
