/**
 * Agent registry — register and look up agent definitions.
 * Singleton Map-based store.
 */
import type { AgentDefinition, AgentId, AgentTrigger } from './types'

class AgentRegistry {
  private agents = new Map<AgentId, AgentDefinition>()

  register(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent)
  }

  get(id: AgentId): AgentDefinition | undefined {
    return this.agents.get(id)
  }

  getByTrigger(trigger: AgentTrigger): AgentDefinition[] {
    return [...this.agents.values()].filter(a => a.triggers.includes(trigger))
  }

  getAll(): AgentDefinition[] {
    return [...this.agents.values()]
  }

  has(id: AgentId): boolean {
    return this.agents.has(id)
  }

  clear(): void {
    this.agents.clear()
  }
}

export const agentRegistry = new AgentRegistry()
