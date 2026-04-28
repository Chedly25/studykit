import { describe, it, expect } from 'vitest'

/**
 * Build pipeline behaviour test. We don't re-run the full pipeline here — that
 * touches the filesystem and is slow. Instead we assert structural properties
 * of the generated manifest, which is the only consumed output of the script.
 *
 * The asset pipeline itself is exercised via the `npm run build:library`
 * idempotency check in CI / pre-deploy.
 */
import { LIBRARY_MANIFEST, LIBRARY_MANIFEST_BUILT_AT } from '../../src/lib/library/manifest.generated'

describe('build-library-assets manifest', () => {
  it('LIBRARY_MANIFEST_BUILT_AT is a valid ISO timestamp', () => {
    expect(LIBRARY_MANIFEST_BUILT_AT).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    const ms = Date.parse(LIBRARY_MANIFEST_BUILT_AT)
    expect(Number.isFinite(ms)).toBe(true)
  })

  it('PDF entries have year extracted when filename matches sujet/grille/rin/etc patterns', () => {
    const pdfs = LIBRARY_MANIFEST.filter(e => e.format === 'pdf')
    const withYear = pdfs.filter(e => e.year !== undefined)
    // At least most PDFs should have a year — sujets, grilles, RIN, calendriers all do.
    expect(withYear.length).toBeGreaterThan(pdfs.length / 2)
  })

  it('CRFPA-officiel sujets carry the matière in the title', () => {
    const sujets = LIBRARY_MANIFEST.filter(e => e.id.includes('sujet-') && e.format === 'pdf')
    expect(sujets.length).toBeGreaterThan(0)
    for (const s of sujets) {
      // Title format: "Sujet YYYY — Matière"
      expect(s.title).toMatch(/Sujet \d{4} — /)
    }
  })

  it('Conseil constitutionnel HTML titles include "Décision n°" and the type', () => {
    const cc = LIBRARY_MANIFEST.filter(e => e.format === 'html' && e.category === 'cc')
    expect(cc.length).toBeGreaterThan(0)
    for (const e of cc) {
      // e.g. "Décision n° 2024-1089 QPC"
      expect(e.title).toMatch(/Décision n°/)
    }
  })

  it('all sizes are positive integers', () => {
    for (const e of LIBRARY_MANIFEST) {
      expect(e.sizeKb).toBeGreaterThan(0)
      expect(Number.isInteger(e.sizeKb)).toBe(true)
    }
  })

  it('grands-arrets entries include a year in tags when the date is parseable', () => {
    const arrets = LIBRARY_MANIFEST.filter(e => e.format === 'grand-arret')
    expect(arrets.length).toBeGreaterThan(0)
    for (const a of arrets) {
      if (a.year !== undefined) {
        expect(a.tags).toContain(String(a.year))
      }
    }
  })
})
