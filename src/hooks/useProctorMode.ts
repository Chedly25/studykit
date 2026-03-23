import { useEffect, useRef, useCallback } from 'react'

interface ProctorFlags {
  tabSwitches: number
  fullscreenExits: number
}

/**
 * Invisible proctoring hook: tracks tab switches and fullscreen exits.
 * Requests fullscreen on activation, exits on deactivation.
 */
export function useProctorMode(active: boolean) {
  const tabSwitches = useRef(0)
  const fullscreenExits = useRef(0)
  const wasActive = useRef(false)

  useEffect(() => {
    if (!active) {
      // If we were active before, exit fullscreen
      if (wasActive.current && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
      wasActive.current = false
      return
    }

    wasActive.current = true
    // Reset counters when activating
    tabSwitches.current = 0
    fullscreenExits.current = 0

    // Request fullscreen
    document.documentElement.requestFullscreen().catch(() => {
      // Browser may block if not triggered by user gesture — that's OK
    })

    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitches.current += 1
      }
    }

    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        fullscreenExits.current += 1
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    document.addEventListener('fullscreenchange', handleFullscreen)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('fullscreenchange', handleFullscreen)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [active])

  const getFlags = useCallback((): ProctorFlags => ({
    tabSwitches: tabSwitches.current,
    fullscreenExits: fullscreenExits.current,
  }), [])

  return { getFlags }
}
