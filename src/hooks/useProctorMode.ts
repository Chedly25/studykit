import { useEffect, useRef, useCallback } from 'react'

export interface ProctorEvent {
  type: 'tab-switch' | 'exit-fullscreen' | 'copy' | 'paste' | 'right-click'
  timestamp: string
}

export interface ProctorFlags {
  tabSwitches: number
  fullscreenExits: number
  copyAttempts: number
  pasteAttempts: number
  rightClicks: number
  events: ProctorEvent[]
}

/**
 * Enhanced proctoring hook: tracks tab switches, fullscreen exits,
 * copy/paste attempts, and right-clicks with per-event timestamps.
 * Requests fullscreen on activation, exits on deactivation.
 */
export function useProctorMode(active: boolean, onEvent?: (event: ProctorEvent) => void) {
  const tabSwitches = useRef(0)
  const fullscreenExits = useRef(0)
  const copyAttempts = useRef(0)
  const pasteAttempts = useRef(0)
  const rightClicks = useRef(0)
  const events = useRef<ProctorEvent[]>([])
  const wasActive = useRef(false)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!active) {
      if (wasActive.current && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
      wasActive.current = false
      return
    }

    wasActive.current = true
    tabSwitches.current = 0
    fullscreenExits.current = 0
    copyAttempts.current = 0
    pasteAttempts.current = 0
    rightClicks.current = 0
    events.current = []

    document.documentElement.requestFullscreen().catch(() => {})

    const logEvent = (type: ProctorEvent['type']) => {
      const event: ProctorEvent = { type, timestamp: new Date().toISOString() }
      events.current.push(event)
      onEventRef.current?.(event)
    }

    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitches.current += 1
        logEvent('tab-switch')
      }
    }

    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        fullscreenExits.current += 1
        logEvent('exit-fullscreen')
      }
    }

    const handleCopy = () => {
      copyAttempts.current += 1
      logEvent('copy')
    }

    const handlePaste = () => {
      pasteAttempts.current += 1
      logEvent('paste')
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      rightClicks.current += 1
      logEvent('right-click')
    }

    document.addEventListener('visibilitychange', handleVisibility)
    document.addEventListener('fullscreenchange', handleFullscreen)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('fullscreenchange', handleFullscreen)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('contextmenu', handleContextMenu)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [active])

  const getFlags = useCallback((): ProctorFlags => ({
    tabSwitches: tabSwitches.current,
    fullscreenExits: fullscreenExits.current,
    copyAttempts: copyAttempts.current,
    pasteAttempts: pasteAttempts.current,
    rightClicks: rightClicks.current,
    events: events.current,
  }), [])

  return { getFlags }
}
