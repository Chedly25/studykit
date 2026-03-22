/**
 * Agent registration — imports all agent definitions and registers them.
 * Import this file once (side-effect) to populate the agent registry.
 */
import { agentRegistry } from './registry'
import { diagnosticianAgent } from './diagnostician'
import { progressMonitorAgent } from './progressMonitor'
import { misconceptionHunterAgent } from './misconceptionHunter'
import { strategistAgent } from './strategist'
import { contentArchitectAgent } from './contentArchitect'

agentRegistry.register(diagnosticianAgent)
agentRegistry.register(progressMonitorAgent)
agentRegistry.register(misconceptionHunterAgent)
agentRegistry.register(strategistAgent)
agentRegistry.register(contentArchitectAgent)
