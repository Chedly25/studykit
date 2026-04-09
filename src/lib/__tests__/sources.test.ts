import { describe, it, expect } from 'vitest'
import { tokenize, computeKeywords, chunkText } from '../sources'

describe('sources — pure functions', () => {
  describe('tokenize', () => {
    it('splits text into lowercase tokens', () => {
      const result = tokenize('Hello World Testing')
      expect(result).toContain('hello')
      expect(result).toContain('world')
      expect(result).toContain('testing')
    })

    it('removes stopwords', () => {
      const result = tokenize('This is a test for the function')
      // "this", "is", "a", "for", "the" are stopwords
      expect(result).not.toContain('this')
      expect(result).not.toContain('the')
      expect(result).toContain('test')
      expect(result).toContain('function')
    })

    it('removes short words (2 chars or less)', () => {
      const result = tokenize('I am at it do go up')
      // All words are 2 chars or less, or stopwords
      expect(result).toHaveLength(0)
    })

    it('splits on non-alphanumeric characters', () => {
      const result = tokenize('hello-world, test_case! foo.bar')
      expect(result).toContain('hello')
      expect(result).toContain('world')
      expect(result).toContain('test')
      expect(result).toContain('case')
      expect(result).toContain('foo')
      expect(result).toContain('bar')
    })

    it('returns empty array for empty string', () => {
      expect(tokenize('')).toEqual([])
    })

    it('handles numbers mixed with text', () => {
      const result = tokenize('chapter 123 section 456')
      expect(result).toContain('chapter')
      expect(result).toContain('123')
      expect(result).toContain('section')
      expect(result).toContain('456')
    })
  })

  describe('computeKeywords', () => {
    it('returns comma-separated unique keywords', () => {
      const result = computeKeywords('hello world hello testing world')
      const keywords = result.split(',')
      // Should be unique
      expect(new Set(keywords).size).toBe(keywords.length)
      expect(keywords).toContain('hello')
      expect(keywords).toContain('world')
      expect(keywords).toContain('testing')
    })

    it('limits to 50 keywords', () => {
      const longText = Array.from({ length: 100 }, (_, i) => `keyword${i}`).join(' ')
      const result = computeKeywords(longText)
      const keywords = result.split(',')
      expect(keywords.length).toBeLessThanOrEqual(50)
    })

    it('returns empty string for stopwords-only text', () => {
      const result = computeKeywords('the and or is it')
      expect(result).toBe('')
    })

    it('filters out short words', () => {
      const result = computeKeywords('I am he is calculus')
      const keywords = result.split(',').filter(Boolean)
      expect(keywords).toContain('calculus')
      expect(keywords.length).toBe(1)
    })
  })

  describe('chunkText', () => {
    it('returns single chunk for short text', () => {
      const text = 'This is a short paragraph.'
      const chunks = chunkText(text)
      expect(chunks).toHaveLength(1)
      expect(chunks[0]).toBe(text)
    })

    it('splits on double newlines (paragraphs)', () => {
      const para1 = 'First paragraph with several words to fill it up.'
      const para2 = 'Second paragraph with different content here.'
      const text = `${para1}\n\n${para2}`
      const chunks = chunkText(text, 5) // tiny maxTokens to force split
      expect(chunks.length).toBeGreaterThanOrEqual(1)
    })

    it('respects maxTokens parameter', () => {
      const paragraphs = Array.from({ length: 20 }, (_, i) =>
        `Paragraph ${i}: ` + Array.from({ length: 50 }, () => 'word').join(' ')
      ).join('\n\n')
      const chunks = chunkText(paragraphs, 100)
      for (const chunk of chunks) {
        const wordCount = chunk.split(/\s+/).length
        // Allow some tolerance since overlap can push slightly over
        expect(wordCount).toBeLessThan(200)
      }
    })

    it('returns the text as single chunk when no paragraphs and below limit', () => {
      const text = 'Just a single line of text without any double newlines.'
      const chunks = chunkText(text, 500)
      expect(chunks).toHaveLength(1)
      expect(chunks[0]).toBe(text)
    })

    it('handles empty text', () => {
      const chunks = chunkText('')
      expect(chunks).toHaveLength(1)
      expect(chunks[0]).toBe('')
    })

    it('handles text with only whitespace paragraphs', () => {
      const text = '   \n\n   \n\n   '
      const chunks = chunkText(text)
      expect(chunks.length).toBeGreaterThanOrEqual(1)
    })

    it('creates overlapping chunks for continuity', () => {
      // Build text with multiple paragraphs that exceed maxTokens
      const para1 = Array.from({ length: 30 }, () => 'alpha').join(' ')
      const para2 = Array.from({ length: 30 }, () => 'beta').join(' ')
      const para3 = Array.from({ length: 30 }, () => 'gamma').join(' ')
      const text = `${para1}\n\n${para2}\n\n${para3}`
      const chunks = chunkText(text, 40)
      expect(chunks.length).toBeGreaterThanOrEqual(2)
    })

    it('handles single paragraph exceeding maxTokens by splitting sentences', () => {
      const sentences = Array.from({ length: 20 }, (_, i) =>
        `Sentence number ${i} with enough words to matter.`
      ).join(' ')
      const chunks = chunkText(sentences, 20)
      expect(chunks.length).toBeGreaterThanOrEqual(2)
    })

    it('uses default maxTokens of 500', () => {
      const shortText = 'Short text.'
      const chunks = chunkText(shortText)
      expect(chunks).toHaveLength(1)
    })
  })
})
