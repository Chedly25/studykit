import { describe, it, expect } from 'vitest'
import { LIBRARY_MANIFEST } from '../manifest.generated'
import type { LibraryCategory, LibraryFormat } from '../types'

const VALID_CATEGORIES: readonly LibraryCategory[] = [
  'codes', 'grands-arrets', 'cc', 'textes', 'crfpa-officiel', 'rapports',
]
const VALID_FORMATS: readonly LibraryFormat[] = [
  'pdf', 'html', 'markdown', 'code-tree', 'grand-arret',
]

describe('LIBRARY_MANIFEST', () => {
  it('is non-empty', () => {
    expect(LIBRARY_MANIFEST.length).toBeGreaterThan(0)
  })

  it('has unique ids', () => {
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const e of LIBRARY_MANIFEST) {
      if (seen.has(e.id)) dupes.push(e.id); else seen.add(e.id)
    }
    expect(dupes).toEqual([])
  })

  it('every entry has a non-empty title', () => {
    for (const e of LIBRARY_MANIFEST) {
      expect(e.title.trim().length).toBeGreaterThan(0)
    }
  })

  it('every entry uses a valid category', () => {
    for (const e of LIBRARY_MANIFEST) {
      expect(VALID_CATEGORIES).toContain(e.category)
    }
  })

  it('every entry uses a valid format', () => {
    for (const e of LIBRARY_MANIFEST) {
      expect(VALID_FORMATS).toContain(e.format)
    }
  })

  it('PDF entries have a path under /library/pdfs/', () => {
    for (const e of LIBRARY_MANIFEST) {
      if (e.format !== 'pdf') continue
      expect(e.path.startsWith('/library/pdfs/')).toBe(true)
    }
  })

  it('code-tree entries have a path under /library/codes/', () => {
    for (const e of LIBRARY_MANIFEST) {
      if (e.format !== 'code-tree') continue
      expect(e.path.startsWith('/library/codes/')).toBe(true)
    }
  })

  it('html entries have a path under /library/cc/', () => {
    for (const e of LIBRARY_MANIFEST) {
      if (e.format !== 'html') continue
      expect(e.path.startsWith('/library/cc/')).toBe(true)
    }
  })

  it('markdown entries have a path under /library/textes/', () => {
    for (const e of LIBRARY_MANIFEST) {
      if (e.format !== 'markdown') continue
      expect(e.path.startsWith('/library/textes/')).toBe(true)
    }
  })

  it('grand-arret entries use a non-URL slug as path', () => {
    for (const e of LIBRARY_MANIFEST) {
      if (e.format !== 'grand-arret') continue
      expect(e.path.startsWith('/')).toBe(false)
      expect(e.path.length).toBeGreaterThan(0)
    }
  })

  it('contains at least one entry per category', () => {
    const found = new Set(LIBRARY_MANIFEST.map(e => e.category))
    for (const cat of VALID_CATEGORIES) {
      expect(found.has(cat), `missing category: ${cat}`).toBe(true)
    }
  })
})
