import { describe, it, expect, vi, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'

const { mockProfilePut, mockSubjectsBulkPut, mockDocFilesPut, otherBulkPut } = vi.hoisted(() => {
  const mockProfilePut = vi.fn().mockResolvedValue(undefined)
  const mockSubjectsBulkPut = vi.fn().mockResolvedValue(undefined)
  const mockDocFilesPut = vi.fn().mockResolvedValue(undefined)
  const otherBulkPut = vi.fn().mockResolvedValue(undefined)
  return { mockProfilePut, mockSubjectsBulkPut, mockDocFilesPut, otherBulkPut }
})

vi.mock('../../db', () => ({
  db: {
    examProfiles: { put: mockProfilePut },
    subjects: { bulkPut: mockSubjectsBulkPut },
    chapters: { bulkPut: otherBulkPut },
    topics: { bulkPut: otherBulkPut },
    subtopics: { bulkPut: otherBulkPut },
    studySessions: { bulkPut: otherBulkPut },
    questionResults: { bulkPut: otherBulkPut },
    documents: { bulkPut: otherBulkPut },
    documentChunks: { bulkPut: otherBulkPut },
    dailyStudyLogs: { bulkPut: otherBulkPut },
    notifications: { bulkPut: otherBulkPut },
    conceptCards: { bulkPut: otherBulkPut },
    exercises: { bulkPut: otherBulkPut },
    exerciseAttempts: { bulkPut: otherBulkPut },
    examSources: { bulkPut: otherBulkPut },
    masterySnapshots: { bulkPut: otherBulkPut },
    pdfHighlights: { bulkPut: otherBulkPut },
    flashcardDecks: { bulkPut: otherBulkPut },
    flashcards: { bulkPut: otherBulkPut },
    tutorPreferences: { bulkPut: otherBulkPut },
    studentModels: { bulkPut: otherBulkPut },
    notificationPreferences: { bulkPut: otherBulkPut },
    documentFiles: { put: mockDocFilesPut },
  },
}))

import { importProfileData } from '../dataExport'

function makeFile(content: string): File {
  return new File([content], 'test.json', { type: 'application/json' })
}

describe('importProfileData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns failure for malformed JSON string', async () => {
    const file = makeFile('not valid json {{{')
    const result = await importProfileData(file)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns error when profile is missing', async () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tables: {},
    }
    const file = makeFile(JSON.stringify(data))
    const result = await importProfileData(file)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('imports valid data and writes to correct tables', async () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: { id: 'prof-1', name: 'Test Profile', examType: 'CRFPA' },
      tables: {
        subjects: [{ id: 'sub-1', name: 'Civil Law', examProfileId: 'prof-1' }],
      },
    }
    const file = makeFile(JSON.stringify(data))
    const result = await importProfileData(file)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(mockProfilePut).toHaveBeenCalledTimes(1)
    expect(mockSubjectsBulkPut).toHaveBeenCalledTimes(1)
    expect(mockSubjectsBulkPut).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'sub-1', name: 'Civil Law' })])
    )
  })
})
