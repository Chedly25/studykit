/**
 * Certification catalog registry.
 * 64 verified certifications as of April 2026.
 */
import type { CertificationEntry } from './types'
import { AWS_CERTS } from './aws'
import { AZURE_CERTS } from './azure'
import { GCP_CERTS } from './gcp'
import { MISC_CERTS } from './misc'

export type { CertificationEntry, CertificationExamFormat, ExtractedSubject, ExtractedChapter, ExtractedTopic } from './types'

export const ALL_CERTIFICATIONS: CertificationEntry[] = [
  ...AWS_CERTS,
  ...AZURE_CERTS,
  ...GCP_CERTS,
  ...MISC_CERTS,
]

/**
 * Match user input against certification aliases.
 * Returns the first matching certification or null.
 */
export function findCertification(userInput: string): CertificationEntry | null {
  if (!userInput) return null
  const input = userInput.trim()
  return ALL_CERTIFICATIONS.find(cert =>
    cert.aliases.some(pattern => pattern.test(input))
  ) ?? null
}

/**
 * Lookup a certification by its unique ID.
 */
export function findCertificationById(id: string): CertificationEntry | null {
  return ALL_CERTIFICATIONS.find(c => c.id === id) ?? null
}
