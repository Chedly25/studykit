/**
 * Maps exam identifiers to R2 library exam IDs.
 * When a library exists for an exam, the library-sync job downloads
 * pre-processed content (papers, courses) into IndexedDB.
 */

const LIBRARY_PATTERNS: Array<{ pattern: RegExp; libraryId: string }> = [
  // CPGE
  { pattern: /cpge.*\bmp\b|mines.*\bmp\b|prépa.*\bmp\b|concours.*\bmp\b/i, libraryId: 'cpge-mp' },
  // Add more as content is uploaded to R2:
  // { pattern: /cpge.*\bpc\b/i, libraryId: 'cpge-pc' },
  // { pattern: /cpge.*\bpsi\b/i, libraryId: 'cpge-psi' },
  // { pattern: /crfpa|barreau/i, libraryId: 'crfpa' },
]

/**
 * Check if a content library exists for a given exam name or certification ID.
 * Returns the R2 library ID or null.
 */
export function getLibraryExamId(examNameOrId: string): string | null {
  if (!examNameOrId) return null
  for (const { pattern, libraryId } of LIBRARY_PATTERNS) {
    if (pattern.test(examNameOrId)) return libraryId
  }
  return null
}
