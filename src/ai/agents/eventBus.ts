/**
 * Swarm Event Bus — lightweight pub/sub for agent communication.
 * Events are dispatched when significant things happen in the app
 * (document processed, exam graded, mastery changed, etc.)
 * The SwarmOrchestrator subscribes and triggers agent chains.
 */

export type SwarmEvent =
  | { type: 'document-processed'; documentId: string; examProfileId: string; category?: string; topicIds?: string[] }
  | { type: 'exam-graded'; sessionId: string; examProfileId: string; totalScore: number; maxScore: number }
  | { type: 'mastery-changed'; topicId: string; examProfileId: string; oldMastery: number; newMastery: number }
  | { type: 'misconception-detected'; examProfileId: string; topicId: string; description: string }
  | { type: 'autopilot-sweep'; examProfileId: string; reason: 'schedule' | 'app-open' | 'reactive' }
  | { type: 'study-session-ended'; examProfileId: string; sessionId: string; durationSeconds: number }
  | { type: 'plan-stale'; examProfileId: string; divergence: number }

type SwarmEventHandler = (event: SwarmEvent) => void

const handlers = new Set<SwarmEventHandler>()

/**
 * Dispatch a swarm event to all subscribers.
 * Safe to call from anywhere (workflows, hooks, components).
 */
export function dispatchSwarmEvent(event: SwarmEvent): void {
  // Use setTimeout to make dispatch async and non-blocking
  setTimeout(() => {
    for (const handler of handlers) {
      try {
        handler(event)
      } catch {
        // Swarm handlers must not crash the calling code
      }
    }
  }, 0)
}

/**
 * Subscribe to swarm events. Returns an unsubscribe function.
 */
export function subscribeSwarmEvents(handler: SwarmEventHandler): () => void {
  handlers.add(handler)
  return () => { handlers.delete(handler) }
}
