import { describe, it, expect } from 'vitest'
import {
  elements,
  categoryColors,
  categoryLabels,
  type ElementCategory,
} from '../periodicTableData'

describe('periodicTableData', () => {
  describe('elements array', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(elements)).toBe(true)
      expect(elements.length).toBeGreaterThan(0)
    })

    it('contains 118 elements', () => {
      expect(elements).toHaveLength(118)
    })

    it('each element has all required fields', () => {
      for (const el of elements) {
        expect(el).toHaveProperty('atomicNumber')
        expect(el).toHaveProperty('symbol')
        expect(el).toHaveProperty('name')
        expect(el).toHaveProperty('atomicMass')
        expect(el).toHaveProperty('category')
        expect(el).toHaveProperty('electronConfig')
        expect(el).toHaveProperty('period')
        // group can be null for lanthanides/actinides
        expect('group' in el).toBe(true)
      }
    })

    it('has correct types for each field', () => {
      for (const el of elements) {
        expect(typeof el.atomicNumber).toBe('number')
        expect(typeof el.symbol).toBe('string')
        expect(typeof el.name).toBe('string')
        expect(typeof el.atomicMass).toBe('string')
        expect(typeof el.category).toBe('string')
        expect(typeof el.electronConfig).toBe('string')
        expect(typeof el.period).toBe('number')
        expect(el.group === null || typeof el.group === 'number').toBe(true)
      }
    })

    it('atomic numbers are sequential from 1 to 118', () => {
      for (let i = 0; i < elements.length; i++) {
        expect(elements[i].atomicNumber).toBe(i + 1)
      }
    })

    it('all symbols are non-empty and unique', () => {
      const symbols = elements.map(el => el.symbol)
      expect(symbols.every(s => s.length > 0)).toBe(true)
      expect(new Set(symbols).size).toBe(symbols.length)
    })

    it('all names are non-empty and unique', () => {
      const names = elements.map(el => el.name)
      expect(names.every(n => n.length > 0)).toBe(true)
      expect(new Set(names).size).toBe(names.length)
    })

    it('periods are between 1 and 7', () => {
      for (const el of elements) {
        expect(el.period).toBeGreaterThanOrEqual(1)
        expect(el.period).toBeLessThanOrEqual(7)
      }
    })

    it('groups are between 1 and 18 or null', () => {
      for (const el of elements) {
        if (el.group !== null) {
          expect(el.group).toBeGreaterThanOrEqual(1)
          expect(el.group).toBeLessThanOrEqual(18)
        }
      }
    })

    it('first element is Hydrogen', () => {
      expect(elements[0].symbol).toBe('H')
      expect(elements[0].name).toBe('Hydrogen')
      expect(elements[0].atomicNumber).toBe(1)
    })

    it('last element is Oganesson', () => {
      const last = elements[elements.length - 1]
      expect(last.symbol).toBe('Og')
      expect(last.name).toBe('Oganesson')
      expect(last.atomicNumber).toBe(118)
    })

    it('contains well-known elements', () => {
      const symbolMap = new Map(elements.map(el => [el.symbol, el]))
      expect(symbolMap.get('O')?.name).toBe('Oxygen')
      expect(symbolMap.get('Fe')?.name).toBe('Iron')
      expect(symbolMap.get('Au')?.name).toBe('Gold')
      expect(symbolMap.get('C')?.name).toBe('Carbon')
    })

    it('lanthanides and actinides have null group', () => {
      const lanthanides = elements.filter(el => el.category === 'lanthanide')
      const actinides = elements.filter(el => el.category === 'actinide')

      expect(lanthanides.length).toBeGreaterThan(0)
      expect(actinides.length).toBeGreaterThan(0)

      for (const el of [...lanthanides, ...actinides]) {
        expect(el.group).toBeNull()
      }
    })

    it('all categories are valid ElementCategory values', () => {
      const validCategories: ElementCategory[] = [
        'alkali-metal', 'alkaline-earth', 'transition-metal',
        'post-transition-metal', 'metalloid', 'nonmetal',
        'halogen', 'noble-gas', 'lanthanide', 'actinide', 'unknown',
      ]
      for (const el of elements) {
        expect(validCategories).toContain(el.category)
      }
    })

    it('all electronConfig strings are non-empty', () => {
      for (const el of elements) {
        expect(el.electronConfig.length).toBeGreaterThan(0)
      }
    })
  })

  describe('categoryColors', () => {
    it('has entries for all 11 categories', () => {
      expect(Object.keys(categoryColors)).toHaveLength(11)
    })

    it('all values are non-empty strings', () => {
      for (const [, value] of Object.entries(categoryColors)) {
        expect(typeof value).toBe('string')
        expect(value.length).toBeGreaterThan(0)
      }
    })

    it('all values contain CSS class-like strings', () => {
      for (const [, value] of Object.entries(categoryColors)) {
        expect(value).toContain('bg-')
        expect(value).toContain('text-')
      }
    })
  })

  describe('categoryLabels', () => {
    it('has entries for all 11 categories', () => {
      expect(Object.keys(categoryLabels)).toHaveLength(11)
    })

    it('all values are non-empty human-readable strings', () => {
      for (const [, value] of Object.entries(categoryLabels)) {
        expect(typeof value).toBe('string')
        expect(value.length).toBeGreaterThan(0)
        // Should start with uppercase
        expect(value[0]).toBe(value[0].toUpperCase())
      }
    })

    it('has matching keys with categoryColors', () => {
      const colorKeys = Object.keys(categoryColors).sort()
      const labelKeys = Object.keys(categoryLabels).sort()
      expect(colorKeys).toEqual(labelKeys)
    })
  })
})
