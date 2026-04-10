import { useState, useCallback } from 'react'
import type { InlineAction } from '../components/actions/types'

/**
 * Manages a single inline action's lifecycle at a mount point.
 *
 * Usage:
 *   const action = useInlineAction()
 *   <button onClick={() => action.dispatch({ type: 'explain-topic', topicId, topicName })}>
 *     Explain
 *   </button>
 *   {action.current && <InlineActionContainer action={action.current} onClose={action.close} />}
 *
 * Scoped per-component instance. No global state. If you dispatch a new action
 * while one is already active, the previous one is replaced.
 */
export function useInlineAction() {
  const [current, setCurrent] = useState<InlineAction | null>(null)

  const dispatch = useCallback((action: InlineAction) => {
    setCurrent(action)
  }, [])

  const close = useCallback(() => {
    setCurrent(null)
  }, [])

  return { current, dispatch, close }
}
