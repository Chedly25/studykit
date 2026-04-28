import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CodeTreeBrowser } from '../CodeTreeBrowser'

const SYNTHETIC_CODE = [
  { id: 'cc-art-1', codeName: 'Test', num: '1', breadcrumb: 'Livre I > Titre I', text: 'Article 1 text' },
  { id: 'cc-art-2', codeName: 'Test', num: '2', breadcrumb: 'Livre I > Titre I', text: 'Article 2 text' },
  { id: 'cc-art-3', codeName: 'Test', num: '3', breadcrumb: 'Livre I > Titre II', text: 'Article 3 text — mention spécifique' },
  { id: 'cc-art-4', codeName: 'Test', num: '4', breadcrumb: 'Livre II', text: 'Article 4 text' },
]

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(SYNTHETIC_CODE), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as unknown as typeof fetch
})

function renderTree() {
  return render(
    <MemoryRouter initialEntries={['/legal/bibliotheque']}>
      <CodeTreeBrowser url="/library/codes/test.json" title="Test code" />
    </MemoryRouter>,
  )
}

describe('CodeTreeBrowser', () => {
  it('loads the JSON and renders article count in the header', async () => {
    renderTree()
    await waitFor(() => expect(screen.getByText(/4 articles/)).toBeTruthy())
  })

  it('renders a tree with the top-level breadcrumb segments', async () => {
    renderTree()
    await waitFor(() => expect(screen.getByText('Livre I')).toBeTruthy())
    expect(screen.getByText('Livre II')).toBeTruthy()
  })

  it('shows the article body when an article is selected', async () => {
    renderTree()
    await waitFor(() => expect(screen.getByText('Livre I')).toBeTruthy())
    // Expand Livre I and click Art. 1.
    fireEvent.click(screen.getByText('Livre I'))
    fireEvent.click(screen.getByText('Titre I'))
    fireEvent.click(screen.getByText('Art. 1'))
    expect(screen.getByText('Article 1 text')).toBeTruthy()
    expect(screen.getByText('Article 1', { selector: 'h3' })).toBeTruthy()
  })

  it('search filters articles by num and by text', async () => {
    renderTree()
    await waitFor(() => expect(screen.getByText('Livre I')).toBeTruthy())
    const search = screen.getByPlaceholderText("N° d'article ou mot-clé") as HTMLInputElement
    fireEvent.change(search, { target: { value: 'spécifique' } })
    expect(screen.getByText(/Art\. 3/)).toBeTruthy()
    // Other articles shouldn't render in the search results pane.
    expect(screen.queryByText(/Art\. 4/)).toBeFalsy()
  })

  it('search by article number works', async () => {
    renderTree()
    await waitFor(() => expect(screen.getByText('Livre I')).toBeTruthy())
    const search = screen.getByPlaceholderText("N° d'article ou mot-clé") as HTMLInputElement
    fireEvent.change(search, { target: { value: '4' } })
    expect(screen.getByText(/Art\. 4/)).toBeTruthy()
  })
})
