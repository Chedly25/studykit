import { describe, it, expect } from 'vitest'
import { EXAM_PRESETS } from '../examPresets'

describe('EXAM_PRESETS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(EXAM_PRESETS)).toBe(true)
    expect(EXAM_PRESETS.length).toBeGreaterThan(0)
  })

  it('each preset has required fields', () => {
    for (const preset of EXAM_PRESETS) {
      expect(preset.id).toBeTruthy()
      expect(typeof preset.name).toBe('string')
      expect(typeof preset.category).toBe('string')
      expect(Array.isArray(preset.sections)).toBe(true)
      expect(preset.sections.length).toBeGreaterThan(0)
    }
  })

  it('each section has required fields', () => {
    for (const preset of EXAM_PRESETS) {
      for (const section of preset.sections) {
        expect(typeof section.formatName).toBe('string')
        expect(typeof section.timeAllocation).toBe('number')
        expect(typeof section.pointWeight).toBe('number')
        expect(typeof section.questionCount).toBe('number')
      }
    }
  })

  it('has no duplicate preset ids', () => {
    const ids = EXAM_PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('section weights sum to reasonable values', () => {
    for (const preset of EXAM_PRESETS) {
      const totalWeight = preset.sections.reduce((s, sec) => s + sec.pointWeight, 0)
      expect(totalWeight).toBeGreaterThan(0)
    }
  })
})
