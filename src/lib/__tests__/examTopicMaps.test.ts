import { describe, it, expect } from 'vitest'
import { examBlueprints } from '../examTopicMaps'

describe('examBlueprints', () => {
  it('contains all expected exam types', () => {
    const keys = Object.keys(examBlueprints)
    expect(keys).toContain('university-course')
    expect(keys).toContain('professional-exam')
    expect(keys).toContain('graduate-research')
    expect(keys).toContain('language-learning')
    expect(keys).toContain('custom')
  })

  it('each blueprint has required fields', () => {
    for (const bp of Object.values(examBlueprints)) {
      expect(typeof bp.examType).toBe('string')
      expect(typeof bp.label).toBe('string')
      expect(typeof bp.description).toBe('string')
      expect(typeof bp.defaultPassingThreshold).toBe('number')
      expect(Array.isArray(bp.subjects)).toBe(true)
    }
  })

  it('custom blueprint has empty subjects for user customization', () => {
    expect(examBlueprints['custom'].subjects).toEqual([])
  })
})
