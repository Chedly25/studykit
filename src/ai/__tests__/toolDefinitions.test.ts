import { describe, it, expect } from 'vitest'
import { agentTools } from '../toolDefinitions'

describe('agentTools', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(agentTools)).toBe(true)
    expect(agentTools.length).toBeGreaterThan(0)
  })

  it('every tool has name, description, and input_schema with type "object"', () => {
    for (const tool of agentTools) {
      expect(tool.name).toBeTruthy()
      expect(typeof tool.name).toBe('string')
      expect(tool.description).toBeTruthy()
      expect(typeof tool.description).toBe('string')
      expect(tool.input_schema).toBeDefined()
      expect(tool.input_schema.type).toBe('object')
    }
  })

  it('has no duplicate tool names', () => {
    const names = agentTools.map(t => t.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('tools with required fields have them as arrays', () => {
    for (const tool of agentTools) {
      if (tool.input_schema.required) {
        expect(Array.isArray(tool.input_schema.required)).toBe(true)
        for (const req of tool.input_schema.required) {
          expect(typeof req).toBe('string')
        }
      }
    }
  })

  it('contains expected tool names', () => {
    const names = new Set(agentTools.map(t => t.name))
    expect(names.has('getKnowledgeGraph')).toBe(true)
    expect(names.has('generateQuestions')).toBe(true)
    expect(names.has('logQuestionResult')).toBe(true)
    expect(names.has('searchSources')).toBe(true)
    expect(names.has('renderConceptCard')).toBe(true)
    expect(names.has('renderQuiz')).toBe(true)
    expect(names.has('executeSequence')).toBe(true)
    expect(names.has('searchWeb')).toBe(true)
  })

  it('tools with properties have them as objects', () => {
    for (const tool of agentTools) {
      if (tool.input_schema.properties) {
        expect(typeof tool.input_schema.properties).toBe('object')
      }
    }
  })

  it('required properties exist in the properties object', () => {
    for (const tool of agentTools) {
      const { required, properties } = tool.input_schema
      if (required && properties) {
        for (const req of required) {
          expect(properties).toHaveProperty(req)
        }
      }
    }
  })
})
