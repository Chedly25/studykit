import { describe, it, expect, beforeEach } from 'vitest'
import { agentRegistry } from '../registry'
import type { AgentDefinition } from '../types'

function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'diagnostician',
    name: 'Diagnostician',
    description: 'Test agent',
    triggers: ['event'],
    model: 'fast',
    cooldownMs: 0,
    execute: async () => ({ success: true, summary: 'done', episodes: [] }),
    ...overrides,
  } as AgentDefinition
}

describe('AgentRegistry', () => {
  beforeEach(() => {
    agentRegistry.clear()
  })

  it('registers and retrieves an agent', () => {
    const agent = makeAgent()
    agentRegistry.register(agent)
    expect(agentRegistry.get('diagnostician')).toBe(agent)
  })

  it('returns undefined for unregistered agent', () => {
    expect(agentRegistry.get('diagnostician')).toBeUndefined()
  })

  it('overwrites on duplicate register', () => {
    agentRegistry.register(makeAgent({ name: 'V1' }))
    agentRegistry.register(makeAgent({ name: 'V2' }))
    expect(agentRegistry.get('diagnostician')?.name).toBe('V2')
  })

  it('getByTrigger returns matching agents', () => {
    agentRegistry.register(makeAgent({ id: 'diagnostician', triggers: ['event', 'schedule'] }))
    agentRegistry.register(makeAgent({ id: 'grader', triggers: ['schedule'] }))
    agentRegistry.register(makeAgent({ id: 'strategist', triggers: ['manual'] }))

    const scheduled = agentRegistry.getByTrigger('schedule')
    expect(scheduled).toHaveLength(2)
    expect(scheduled.map(a => a.id)).toContain('diagnostician')
    expect(scheduled.map(a => a.id)).toContain('grader')
  })

  it('getByTrigger returns empty for no matches', () => {
    agentRegistry.register(makeAgent({ triggers: ['manual'] }))
    expect(agentRegistry.getByTrigger('schedule')).toHaveLength(0)
  })

  it('getAll returns all registered agents', () => {
    agentRegistry.register(makeAgent({ id: 'diagnostician' }))
    agentRegistry.register(makeAgent({ id: 'grader' }))
    expect(agentRegistry.getAll()).toHaveLength(2)
  })

  it('has returns true for registered, false for unregistered', () => {
    agentRegistry.register(makeAgent())
    expect(agentRegistry.has('diagnostician')).toBe(true)
    expect(agentRegistry.has('grader')).toBe(false)
  })

  it('clear removes all agents', () => {
    agentRegistry.register(makeAgent())
    agentRegistry.clear()
    expect(agentRegistry.getAll()).toHaveLength(0)
  })
})
